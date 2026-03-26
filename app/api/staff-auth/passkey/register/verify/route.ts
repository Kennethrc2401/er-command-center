import { ConvexHttpClient } from "convex/browser";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { NextRequest, NextResponse } from "next/server";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { getPasskeyExpectedOrigins, getPasskeyRpId } from "@/lib/passkeys";
import {
  STAFF_PASSKEY_CHALLENGE_COOKIE,
  verifyStaffPasskeyChallengeToken,
} from "@/lib/staffPasskeyChallenge";

export const runtime = "nodejs";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

export async function POST(request: NextRequest) {
  if (!convexUrl) {
    return NextResponse.json({ error: "Convex URL is not configured." }, { status: 500 });
  }

  const challengeToken = request.cookies.get(STAFF_PASSKEY_CHALLENGE_COOKIE)?.value;
  const challenge = await verifyStaffPasskeyChallengeToken(challengeToken);

  if (!challenge || challenge.type !== "registration") {
    return NextResponse.json({ error: "Registration challenge expired. Please try again." }, { status: 400 });
  }

  try {
    const body = (await request.json()) as {
      response?: unknown;
      passkeyName?: string;
    };

    if (!body.response) {
      return NextResponse.json({ error: "Missing passkey response." }, { status: 400 });
    }

    const responsePayload = body.response as Parameters<typeof verifyRegistrationResponse>[0]["response"];

    const convex = new ConvexHttpClient(convexUrl);

    const runtimeOrigin = request.nextUrl.origin;

    const verification = await verifyRegistrationResponse({
      response: responsePayload,
      expectedChallenge: challenge.challenge,
      expectedOrigin: getPasskeyExpectedOrigins(runtimeOrigin),
      expectedRPID: getPasskeyRpId(runtimeOrigin),
      requireUserVerification: true,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json({ error: "Passkey registration could not be verified." }, { status: 400 });
    }

    const { registrationInfo } = verification;

    await convex.mutation(api.passkeys.registerPasskey, {
      userId: challenge.userId as Id<"users">,
      credentialId: registrationInfo.credential.id,
      publicKey: isoBase64URL.fromBuffer(registrationInfo.credential.publicKey),
      counter: registrationInfo.credential.counter,
      transports: registrationInfo.credential.transports,
      deviceType: registrationInfo.credentialDeviceType,
      backedUp: registrationInfo.credentialBackedUp,
      name: body.passkeyName?.trim() || undefined,
    });

    const response = NextResponse.json({ ok: true });
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
    const message = error instanceof Error ? error.message : "Unable to complete passkey registration.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
