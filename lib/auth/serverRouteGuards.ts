import { auth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { isAdminRole } from "@/lib/auth/roles";
import { STAFF_SESSION_COOKIE, verifyStaffSessionToken } from "@/lib/staffSessionToken";

export async function isAdminRequest(request: NextRequest): Promise<boolean> {
  const staffToken = request.cookies.get(STAFF_SESSION_COOKIE)?.value;
  const staffSession = await verifyStaffSessionToken(staffToken);

  if (isAdminRole(staffSession?.role)) {
    return true;
  }

  const clerkSession = await auth();
  const clerkRole = (clerkSession.sessionClaims?.metadata as { role?: string } | undefined)?.role;

  return Boolean(clerkSession.userId && isAdminRole(clerkRole));
}
