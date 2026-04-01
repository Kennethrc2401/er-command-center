import { ConvexHttpClient } from "convex/browser";
import { NextRequest, NextResponse } from "next/server";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { STAFF_SESSION_COOKIE, verifyStaffSessionToken } from "@/lib/staffSessionToken";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

export async function POST(request: NextRequest) {
  if (convexUrl) {
    const token = request.cookies.get(STAFF_SESSION_COOKIE)?.value;
    const payload = await verifyStaffSessionToken(token);

    if (payload) {
      const convex = new ConvexHttpClient(convexUrl);
      void convex.mutation(api.audit.logEvent, {
        userId: payload.userId as Id<"users">,
        userName: payload.name,
        action: "STAFF_LOGOUT",
        patientName: "System",
        metadata: `Method=staff-session; username=${payload.username}`,
      });
    }
  }

  const response = NextResponse.json({ ok: true });

  response.cookies.set({
    name: STAFF_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}
