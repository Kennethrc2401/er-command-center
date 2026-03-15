import { ConvexHttpClient } from "convex/browser";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { NextRequest, NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import {
  createStaffPasskeyChallengeToken,
  STAFF_PASSKEY_CHALLENGE_COOKIE,
  STAFF_PASSKEY_CHALLENGE_TTL_MS,
} from "@/lib/staffPasskeyChallenge";
import { getPasskeyExpectedOrigins, getPasskeyRpId } from "@/lib/passkeys";

export const runtime = "nodejs";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

const getClientIp = (request: NextRequest) => {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const [firstIp] = forwardedFor.split(",");
    const candidate = firstIp?.trim();
    if (candidate) return candidate;
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  const cloudflareIp = request.headers.get("cf-connecting-ip")?.trim();
  if (cloudflareIp) return cloudflareIp;

  return "unknown";
};

export async function POST(request: NextRequest) {
  if (!convexUrl) {
    return NextResponse.json({ error: "Convex URL is not configured." }, { status: 500 });
  }

  try {
    const body = (await request.json()) as { username?: string };
    const username = body.username?.trim();

    if (!username) {
      return NextResponse.json({ error: "Username is required." }, { status: 400 });
    }

    const convex = new ConvexHttpClient(convexUrl);
    const ipKey = getClientIp(request);

    const ipRate = await convex.mutation(api.users.consumeStaffIpRateLimit, {
      key: ipKey,
    });

    if (!ipRate.allowed) {
      return NextResponse.json(
        {
          error: `Too many login attempts from this location. Try again in ${Math.max(1, Math.ceil(ipRate.retryAfterSeconds / 60))} minute(s).`,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(ipRate.retryAfterSeconds),
          },
        }
      );
    }

    const user = await convex.query(api.users.getStaffAuthUserByUsername, { username });

    if (!user || user.status !== "ACTIVE") {
      return NextResponse.json({ error: "Passkey sign-in is not available for this account." }, { status: 404 });
    }

    if ((user.lockedUntil ?? 0) > Date.now()) {
      const minutesRemaining = Math.max(1, Math.ceil(((user.lockedUntil ?? 0) - Date.now()) / 60000));
      return NextResponse.json(
        {
          error: `Account locked due to repeated failed attempts. Try again in ${minutesRemaining} minute${minutesRemaining === 1 ? "" : "s"}.`,
        },
        { status: 429 }
      );
    }

    const passkeys = await convex.query(api.passkeys.getPasskeysByUser, {
      userId: user.userId,
    });

    if (!passkeys.length) {
      return NextResponse.json(
        { error: "No passkey enrolled for this account yet." },
        { status: 404 }
      );
    }

    const options = await generateAuthenticationOptions({
      rpID: getPasskeyRpId(),
      timeout: 60000,
      userVerification: "preferred",
      allowCredentials: passkeys.map((passkey) => ({
        id: passkey.credentialId,
      })),
    });

    const challengeToken = await createStaffPasskeyChallengeToken({
      challenge: options.challenge,
      type: "authentication",
      userId: user.userId,
      username: user.username,
      ipKey,
    });

    const response = NextResponse.json({
      options,
      expectedOrigins: getPasskeyExpectedOrigins(),
    });

    response.cookies.set({
      name: STAFF_PASSKEY_CHALLENGE_COOKIE,
      value: challengeToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: Math.floor(STAFF_PASSKEY_CHALLENGE_TTL_MS / 1000),
    });

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start passkey sign-in.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
