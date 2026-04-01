import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
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

  if (isStaffDashboardRoute(request)) {
    if (staffSession) {
      if (isAdminRoute(request) && staffSession.role !== "ADMIN") {
        const url = new URL("/dashboard/triage", request.url);
        return NextResponse.redirect(url);
      }
      return;
    }

    const session = await auth();
    if (!session.userId) {
      const url = new URL("/staff-login", request.url);
      return NextResponse.redirect(url);
    }

    if (isAdminRoute(request)) {
      const role = (session.sessionClaims?.metadata as { role?: string })?.role;
      if (role !== "admin") {
        const url = new URL("/dashboard/triage", request.url);
        return NextResponse.redirect(url);
      }
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

  const session = await auth();
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
