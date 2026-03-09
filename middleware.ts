import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";


const isPublicRoute = createRouteMatcher([
  '/', 
  '/login(.*)', 
  '/sign-up(.*)', 
  '/kiosk(.*)' // 🚀 Add this so patients can check in!
]);
const isAdminRoute = createRouteMatcher(['/dashboard/admin(.*)']);


export default clerkMiddleware(async (auth, request) => {
  // 1. If it's a public route, let them through
  if (isPublicRoute(request)) return;

  // 2. Protect all other routes (forces login)
  const session = await auth();
  if (!session.userId) return session.redirectToSignIn();

  // 3. ROLE CHECK: If they are heading to Admin, check their metadata
  if (isAdminRoute(request)) {
    const role = (session.sessionClaims?.metadata as { role?: string })?.role;
    
    if (role !== "admin") {
      // Redirect "Clinical Users" away from Admin pages
      const url = new URL("/dashboard/triage", request.url);
      return NextResponse.redirect(url);
    }
  }
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};