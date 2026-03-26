import { ConvexHttpClient } from "convex/browser";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import { NextRequest, NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import { getPasskeyExpectedOrigins, getPasskeyRpId } from "@/lib/passkeys";
import {
  STAFF_PASSKEY_CHALLENGE_COOKIE,
  verifyStaffPasskeyChallengeToken,
} from "@/lib/staffPasskeyChallenge";
import {
  createStaffSessionToken,
  STAFF_SESSION_COOKIE,
  STAFF_SESSION_TTL_MS,
} from "@/lib/staffSessionToken";

export const runtime = "nodejs";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

export async function POST(request: NextRequest) {
  if (!convexUrl) {
    return NextResponse.json({ error: "Convex URL is not configured." }, { status: 500 });
  }

  const challengeToken = request.cookies.get(STAFF_PASSKEY_CHALLENGE_COOKIE)?.value;
  const challenge = await verifyStaffPasskeyChallengeToken(challengeToken);

  if (!challenge || challenge.type !== "authentication") {
    return NextResponse.json({ error: "Passkey challenge expired. Please try again." }, { status: 400 });
  }

  try {
    const body = (await request.json()) as {
      username?: string;
      response?: {
        id: string;
      };
    };

    const username = body.username?.trim().toLowerCase();
    if (!username || !body.response?.id) {
      return NextResponse.json({ error: "Username and passkey response are required." }, { status: 400 });
    }

    if (username !== challenge.username.toLowerCase()) {
      return NextResponse.json({ error: "Passkey challenge does not match this account." }, { status: 400 });
    }

    const responsePayload = body.response as Parameters<typeof verifyAuthenticationResponse>[0]["response"];

    const convex = new ConvexHttpClient(convexUrl);
    const user = await convex.query(api.users.getStaffAuthUserByUsername, {
      username,
    });

    if (!user || user.status !== "ACTIVE") {
      return NextResponse.json({ error: "Invalid staff credentials." }, { status: 401 });
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

    const passkey = await convex.query(api.passkeys.getPasskeyByCredentialId, {
      credentialId: body.response.id,
    });

    if (!passkey || passkey.userId !== user.userId) {
      await convex.mutation(api.users.recordStaffLoginFailure, {
        userId: user.userId,
      });
      return NextResponse.json({ error: "Invalid staff credentials." }, { status: 401 });
    }

    const runtimeOrigin = request.nextUrl.origin;

    const verification = await verifyAuthenticationResponse({
      response: responsePayload,
      expectedChallenge: challenge.challenge,
      expectedOrigin: getPasskeyExpectedOrigins(runtimeOrigin),
      expectedRPID: getPasskeyRpId(runtimeOrigin),
      requireUserVerification: true,
      credential: {
        id: passkey.credentialId,
        publicKey: isoBase64URL.toBuffer(passkey.publicKey),
        counter: passkey.counter,
      },
    });

    if (!verification.verified) {
      await convex.mutation(api.users.recordStaffLoginFailure, {
        userId: user.userId,
      });
      return NextResponse.json({ error: "Invalid staff credentials." }, { status: 401 });
    }

    await Promise.all([
      convex.mutation(api.users.recordStaffLoginSuccess, {
        userId: user.userId,
      }),
      convex.mutation(api.passkeys.markPasskeyUsed, {
        credentialId: passkey.credentialId,
        counter: verification.authenticationInfo.newCounter,
      }),
      convex.mutation(api.users.clearStaffIpRateLimit, {
        key: challenge.ipKey,
      }),
    ]);

    const token = await createStaffSessionToken({
      userId: user.userId,
      name: user.name,
      username: user.username,
      role: user.role,
    });

    const response = NextResponse.json({
      ok: true,
      user: {
        name: user.name,
        username: user.username,
        role: user.role,
      },
    });

    response.cookies.set({
      name: STAFF_SESSION_COOKIE,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: Math.floor(STAFF_SESSION_TTL_MS / 1000),
    });

    response.cookies.set({
      name: STAFF_PASSKEY_CHALLENGE_COOKIE,
      value: "",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to complete passkey sign-in.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
