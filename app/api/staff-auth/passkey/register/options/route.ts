import { ConvexHttpClient } from "convex/browser";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { NextRequest, NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import { getPasskeyExpectedOrigins, getPasskeyRpId, getPasskeyRpName } from "@/lib/passkeys";
import {
  createStaffPasskeyChallengeToken,
  STAFF_PASSKEY_CHALLENGE_COOKIE,
  STAFF_PASSKEY_CHALLENGE_TTL_MS,
} from "@/lib/staffPasskeyChallenge";

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
    const body = (await request.json()) as {
      username?: string;
      password?: string;
      officeKey?: string;
    };

    const username = body.username?.trim();
    const password = body.password?.trim();
    const officeKey = body.officeKey?.trim();

    if (!username || !password || !officeKey) {
      return NextResponse.json(
        { error: "Username, password, and office key are required." },
        { status: 400 }
      );
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

    const user = await convex.mutation(api.users.verifyStaffCredentials, {
      username,
      password,
      officeKey,
    });

    const existingPasskeys = await convex.query(api.passkeys.getPasskeysByUser, {
      userId: user.userId,
    });

    const runtimeOrigin = request.nextUrl.origin;

    const options = await generateRegistrationOptions({
      rpID: getPasskeyRpId(runtimeOrigin),
      rpName: getPasskeyRpName(),
      userID: new TextEncoder().encode(user.userId),
      userName: user.username,
      userDisplayName: user.name,
      timeout: 60000,
      attestationType: "none",
      excludeCredentials: existingPasskeys.map((passkey) => ({
        id: passkey.credentialId,
      })),
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
      },
    });

    const challengeToken = await createStaffPasskeyChallengeToken({
      challenge: options.challenge,
      type: "registration",
      userId: user.userId,
      username: user.username,
      ipKey,
    });

    await convex.mutation(api.users.clearStaffIpRateLimit, {
      key: ipKey,
    });

    const response = NextResponse.json({
      options,
      expectedOrigins: getPasskeyExpectedOrigins(runtimeOrigin),
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
    const message = error instanceof Error ? error.message : "Unable to begin passkey registration.";
    const isLockMessage = /locked|too many failed attempts|too many login attempts/i.test(message);

    return NextResponse.json({ error: message }, { status: isLockMessage ? 429 : 401 });
  }
}
