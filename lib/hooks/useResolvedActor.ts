"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { useMemo } from "react";
import { normalizeActorRole } from "@/lib/auth/roles";
import { useStaffSession } from "@/lib/hooks/useStaffSession";

export function useResolvedActor() {
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const staffSession = useStaffSession();

  const clerkRole = normalizeActorRole(user?.publicMetadata?.role);
  const staffRole = normalizeActorRole(staffSession.user?.role);

  const actorRole =
    isSignedIn && clerkRole !== "UNKNOWN"
      ? clerkRole
      : staffRole !== "UNKNOWN"
        ? staffRole
        : clerkRole;

  const clerkDisplayName = useMemo(
    () =>
      [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
      user?.username ||
      user?.primaryEmailAddress?.emailAddress ||
      "",
    [user]
  );

  const actorName =
    (isSignedIn && clerkDisplayName) ||
    staffSession.user?.name ||
    clerkDisplayName ||
    "Staff";

  return {
    actorRole,
    actorName,
    isAdmin: actorRole === "ADMIN",
    isAuthenticated: Boolean(isSignedIn || staffSession.authenticated),
    isResolvingAuth: !isSignedIn && staffSession.loading,
  };
}
