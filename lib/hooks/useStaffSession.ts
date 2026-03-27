"use client";

import { useCallback, useEffect, useState } from "react";
import type { StaffRole } from "@/lib/staffSessionToken";

const STAFF_SESSION_UPDATED_EVENT = "staff-session-updated";

type StaffSessionUser = {
  userId: string;
  name: string;
  username: string;
  role: StaffRole;
};

type StaffSessionState = {
  loading: boolean;
  authenticated: boolean;
  user: StaffSessionUser | null;
  refresh: () => Promise<void>;
};

export function notifyStaffSessionUpdated() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(STAFF_SESSION_UPDATED_EVENT));
}

export function useStaffSession(): StaffSessionState {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [user, setUser] = useState<StaffSessionUser | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/staff-auth/session", {
        method: "GET",
        cache: "no-store",
        credentials: "include",
      });

      if (!response.ok) {
        setAuthenticated(false);
        setUser(null);
        return;
      }

      const data = (await response.json()) as {
        authenticated?: boolean;
        user?: StaffSessionUser;
      };

      if (data.authenticated && data.user) {
        setAuthenticated(true);
        setUser(data.user);
      } else {
        setAuthenticated(false);
        setUser(null);
      }
    } catch {
      setAuthenticated(false);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleSessionUpdate = () => {
      void refresh();
    };

    const handleFocus = () => {
      void refresh();
    };

    window.addEventListener(STAFF_SESSION_UPDATED_EVENT, handleSessionUpdate);
    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener(STAFF_SESSION_UPDATED_EVENT, handleSessionUpdate);
      window.removeEventListener("focus", handleFocus);
    };
  }, [refresh]);

  return { loading, authenticated, user, refresh };
}
