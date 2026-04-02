import { describe, expect, it } from "vitest";
import { resolveDashboardAccess } from "./dashboardAccess";

describe("resolveDashboardAccess", () => {
  it("allows staff-authenticated users into clinical dashboard routes", () => {
    expect(
      resolveDashboardAccess({
        path: "/dashboard/triage",
        hasStaffSession: true,
        staffRole: "NURSE",
        hasClerkSession: false,
      })
    ).toEqual({ allowed: true });
  });

  it("redirects non-admin staff away from admin dashboard routes", () => {
    expect(
      resolveDashboardAccess({
        path: "/dashboard/admin/security",
        hasStaffSession: true,
        staffRole: "NURSE",
        hasClerkSession: false,
      })
    ).toEqual({ allowed: false, redirectTo: "/dashboard/triage" });
  });

  it("allows Clerk admin users into admin dashboard routes", () => {
    expect(
      resolveDashboardAccess({
        path: "/dashboard/admin/security",
        hasStaffSession: false,
        hasClerkSession: true,
        clerkRole: "admin",
      })
    ).toEqual({ allowed: true });
  });

  it("redirects unauthenticated dashboard visits to staff login", () => {
    expect(
      resolveDashboardAccess({
        path: "/dashboard/triage",
        hasStaffSession: false,
        hasClerkSession: false,
      })
    ).toEqual({ allowed: false, redirectTo: "/staff-login" });
  });

  it("allows non-dashboard routes through untouched", () => {
    expect(
      resolveDashboardAccess({
        path: "/public/landing",
        hasStaffSession: false,
        hasClerkSession: false,
      })
    ).toEqual({ allowed: true });
  });
});
