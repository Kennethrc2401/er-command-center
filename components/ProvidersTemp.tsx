"use client";

import { ReactNode } from "react";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { ThemeProvider } from "next-themes";
import { useStaffSession } from "@/lib/hooks/useStaffSession";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * Wrapper to inject useAuth - checks both Clerk and Staff Session
 */
function AuthAdapter() {
  const clerkAuth = useAuth();
  const staffSession = useStaffSession();

  // Return Clerk auth if available, otherwise return an object that indicates auth is resolved
  // If staff session is active, Convex will use the cookie-based auth
  if (staffSession.authenticated && !clerkAuth.isSignedIn) {
    // Create a mock auth object that prevents redirect
    return {
      isLoaded: true,
      isSignedIn: false,
      sessionId: null,
    };
  }

  return clerkAuth;
}

function ProviderInner({ children }: { children: ReactNode }) {
  const auth = AuthAdapter();
  
  return (
    <ConvexProviderWithClerk client={convex} useAuth={() => auth}>
      {children}
    </ConvexProviderWithClerk>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY!}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <ProviderInner>
          {children}
        </ProviderInner>
      </ThemeProvider>
    </ClerkProvider>
  );
}