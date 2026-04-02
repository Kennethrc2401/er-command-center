import type { StaffRole } from "@/lib/staffSessionToken";

export type DashboardAccessDecision =
  | { allowed: true }
  | { allowed: false; redirectTo: "/staff-login" | "/dashboard/triage" };

export type DashboardAccessInput = {
  path: string;
  hasStaffSession: boolean;
  staffRole?: StaffRole;
  hasClerkSession: boolean;
  clerkRole?: string | null;
};

const isDashboardRoute = (path: string) => path.startsWith("/dashboard");
const isAdminRoute = (path: string) => path.startsWith("/dashboard/admin");

export function resolveDashboardAccess(input: DashboardAccessInput): DashboardAccessDecision {
  if (!isDashboardRoute(input.path)) {
    return { allowed: true };
  }

  if (input.hasStaffSession) {
    if (isAdminRoute(input.path) && input.staffRole !== "ADMIN") {
      return { allowed: false, redirectTo: "/dashboard/triage" };
    }

    return { allowed: true };
  }

  if (!input.hasClerkSession) {
    return { allowed: false, redirectTo: "/staff-login" };
  }

  if (isAdminRoute(input.path) && input.clerkRole !== "admin") {
    return { allowed: false, redirectTo: "/dashboard/triage" };
  }

  return { allowed: true };
}
