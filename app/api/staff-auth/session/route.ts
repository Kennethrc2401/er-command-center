import { NextRequest, NextResponse } from "next/server";
import { STAFF_SESSION_COOKIE, verifyStaffSessionToken } from "@/lib/staffSessionToken";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(STAFF_SESSION_COOKIE)?.value;

  const payload = await verifyStaffSessionToken(token);

  if (!payload) {
    return NextResponse.json({ authenticated: false }, { status: 200 });
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      userId: payload.userId,
      name: payload.name,
      username: payload.username,
      role: payload.role,
    },
  });
}
