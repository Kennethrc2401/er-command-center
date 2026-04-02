import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { resolveDashboardAccess } from "@/lib/auth/dashboardAccess";
import { STAFF_SESSION_COOKIE, verifyStaffSessionToken } from "@/lib/staffSessionToken";

const isPublicRoute = createRouteMatcher([
  "/",
  "/login(.*)",
  "/sign-up(.*)",
  "/kiosk(.*)",
  "/staff-login(.*)",
  "/api/staff-auth(.*)",
]);

const isAdminRoute = createRouteMatcher(["/dashboard/admin(.*)"]);
const isStaffDashboardRoute = createRouteMatcher(["/dashboard(.*)"]);

export default clerkMiddleware(async (auth, request) => {
  if (isPublicRoute(request)) return;

  const staffToken = request.cookies.get(STAFF_SESSION_COOKIE)?.value;
  const staffSession = await verifyStaffSessionToken(staffToken);
  const session = await auth();

  if (isStaffDashboardRoute(request)) {
    const decision = resolveDashboardAccess({
      path: request.nextUrl.pathname,
      hasStaffSession: Boolean(staffSession),
      staffRole: staffSession?.role,
      hasClerkSession: Boolean(session.userId),
      clerkRole: (session.sessionClaims?.metadata as { role?: string } | undefined)?.role ?? null,
    });

    if (!decision.allowed) {
      const url = new URL(decision.redirectTo, request.url);
      return NextResponse.redirect(url);
    }

    return;
  }

  if (staffSession) {
    if (isAdminRoute(request) && staffSession.role !== "ADMIN") {
      const url = new URL("/dashboard/triage", request.url);
      return NextResponse.redirect(url);
    }
    return;
  }

  if (!session.userId) return session.redirectToSignIn();

  if (isAdminRoute(request)) {
    const role = (session.sessionClaims?.metadata as { role?: string })?.role;
    if (role !== "admin") {
      const url = new URL("/dashboard/triage", request.url);
      return NextResponse.redirect(url);
    }
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
