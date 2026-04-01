import { ConvexHttpClient } from "convex/browser";
import { NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import {
  createStaffSessionToken,
  STAFF_SESSION_COOKIE,
  STAFF_SESSION_TTL_MS,
} from "@/lib/staffSessionToken";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

const getClientIp = (request: Request) => {
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

  const userAgent = request.headers.get("user-agent")?.trim();
  if (userAgent) return `unknown:${userAgent.slice(0, 80)}`;

  return "unknown";
};

export async function POST(request: Request) {
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
      return NextResponse.json({ error: "Username, password, and office key are required." }, { status: 400 });
    }

    const convex = new ConvexHttpClient(convexUrl);
    const ipKey = getClientIp(request);

    // Opportunistic housekeeping to keep throttle storage bounded.
    void convex.mutation(api.users.pruneStaleStaffIpThrottles, {
      nowTs: Date.now(),
      limit: 25,
    });

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

    await convex.mutation(api.audit.logEvent, {
      userId: user.userId,
      userName: user.name,
      action: "STAFF_LOGIN_SUCCESS",
      patientName: "System",
      metadata: `Method=password; username=${user.username}; ipKey=${ipKey}`,
    });

    await convex.mutation(api.users.clearStaffIpRateLimit, {
      key: ipKey,
    });

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

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid staff credentials.";
    const isLockMessage = /locked|too many failed attempts|too many login attempts/i.test(message);

    return NextResponse.json(
      { error: message },
      { status: isLockMessage ? 429 : 401 }
    );
  }
}
