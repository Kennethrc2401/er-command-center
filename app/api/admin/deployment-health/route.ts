import { NextRequest, NextResponse } from "next/server";
import { getPasskeyExpectedOrigins, getPasskeyRpId } from "@/lib/passkeys";
import { isAdminRequest } from "@/lib/auth/serverRouteGuards";

export const runtime = "nodejs";

type Check = {
  key: string;
  label: string;
  status: "ok" | "warn" | "fail";
  detail: string;
  fixStep?: string;
};

const isLikelySecret = (value: string | undefined) =>
  Boolean(value && value.length >= 24 && !value.includes("change-me"));

const isHostCompatibleWithRpId = (host: string, rpId: string) =>
  host === rpId || host.endsWith(`.${rpId}`);

export async function GET(request: NextRequest) {
  const isAdmin = await isAdminRequest(request);

  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const deploymentOrigin = request.nextUrl.origin;
  const deploymentHost = request.nextUrl.hostname;

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL?.trim();
  const clerkPk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim();
  const sessionSecret = process.env.STAFF_AUTH_SESSION_SECRET;
  const passkeyChallengeSecret = process.env.STAFF_PASSKEY_CHALLENGE_SECRET;

  const rpId = getPasskeyRpId(deploymentOrigin);
  const allowedOrigins = getPasskeyExpectedOrigins(deploymentOrigin);
  const vercelEnvUrl =
    process.env.NEXT_PUBLIC_VERCEL_ENV_URL?.trim() ||
    "https://vercel.com/dashboard";

  const checks: Check[] = [
    {
      key: "convex-url",
      label: "Convex URL",
      status: convexUrl ? "ok" : "fail",
      detail: convexUrl ? "Configured" : "NEXT_PUBLIC_CONVEX_URL missing.",
      fixStep: convexUrl
        ? undefined
        : "Set NEXT_PUBLIC_CONVEX_URL in Vercel project environment variables, then redeploy.",
    },
    {
      key: "clerk-pk",
      label: "Clerk Publishable Key",
      status: clerkPk ? "ok" : "fail",
      detail: clerkPk ? "Configured" : "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY missing.",
      fixStep: clerkPk
        ? undefined
        : "Set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY in Vercel project environment variables, then redeploy.",
    },
    {
      key: "staff-session-secret",
      label: "Staff Session Secret",
      status: isLikelySecret(sessionSecret) ? "ok" : "warn",
      detail: isLikelySecret(sessionSecret)
        ? "Looks production-safe."
        : "STAFF_AUTH_SESSION_SECRET is weak/default or missing.",
      fixStep: isLikelySecret(sessionSecret)
        ? undefined
        : "Generate a strong random secret (>=32 chars) and set STAFF_AUTH_SESSION_SECRET in production env.",
    },
    {
      key: "passkey-challenge-secret",
      label: "Passkey Challenge Secret",
      status: isLikelySecret(passkeyChallengeSecret) ? "ok" : "warn",
      detail: isLikelySecret(passkeyChallengeSecret)
        ? "Looks production-safe."
        : "STAFF_PASSKEY_CHALLENGE_SECRET is weak/default or missing.",
      fixStep: isLikelySecret(passkeyChallengeSecret)
        ? undefined
        : "Generate a strong random secret (>=32 chars) and set STAFF_PASSKEY_CHALLENGE_SECRET in production env.",
    },
    {
      key: "passkey-rpid-match",
      label: "Passkey RP ID",
      status: isHostCompatibleWithRpId(deploymentHost, rpId) ? "ok" : "fail",
      detail: isHostCompatibleWithRpId(deploymentHost, rpId)
        ? `RP ID '${rpId}' matches host '${deploymentHost}'.`
        : `RP ID '${rpId}' does not match host '${deploymentHost}'.`,
      fixStep: isHostCompatibleWithRpId(deploymentHost, rpId)
        ? undefined
        : `Set PASSKEY_RP_ID to '${deploymentHost}' (or parent domain that validly matches this host), then redeploy.`,
    },
    {
      key: "passkey-origin-allowlist",
      label: "Passkey Allowed Origins",
      status: allowedOrigins.includes(deploymentOrigin) ? "ok" : "fail",
      detail: allowedOrigins.includes(deploymentOrigin)
        ? `Origin '${deploymentOrigin}' is allowed.`
        : `Origin '${deploymentOrigin}' is missing from PASSKEY_ALLOWED_ORIGINS.`,
      fixStep: allowedOrigins.includes(deploymentOrigin)
        ? undefined
        : `Append '${deploymentOrigin}' to PASSKEY_ALLOWED_ORIGINS (comma-separated), then redeploy.`,
    },
  ];

  const summaryStatus = checks.some((check) => check.status === "fail")
    ? "fail"
    : checks.some((check) => check.status === "warn")
      ? "warn"
      : "ok";

  return NextResponse.json({
    summaryStatus,
    deploymentOrigin,
    deploymentHost,
    rpId,
    allowedOrigins,
    vercelEnvUrl,
    checks,
  });
}
