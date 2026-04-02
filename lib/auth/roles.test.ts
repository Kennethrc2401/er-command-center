import { describe, expect, it } from "vitest";
import {
  ROLE_POLICY_MATRIX,
  actionRequiresBreakGlass,
  canRoleAccessRoute,
  canRolePerformAction,
  getRolePolicy,
  type PolicyActionKey,
} from "./roles";
import type { StaffRole } from "@/lib/staffSessionToken";

const HIGH_RISK_ACTIONS: PolicyActionKey[] = [
  "manage_users",
  "manage_passkeys",
  "clear_throttle",
  "unlock_staff",
];

describe("ROLE_POLICY_MATRIX", () => {
  it("covers every staff role exactly once", () => {
    const roles = ROLE_POLICY_MATRIX.map((policy) => policy.role);
    expect(new Set(roles).size).toBe(ROLE_POLICY_MATRIX.length);
    expect(roles).toEqual([
      "ADMIN",
      "DOCTOR",
      "SURGEON",
      "ANESTHESIOLOGIST",
      "NURSE",
      "CCMA",
      "PHARMACIST",
      "RESPIRATORY_THERAPIST",
      "RAD_TECH",
      "SCRUB_TECH",
      "UNIT_COORDINATOR",
    ]);
  });

  it("allows only ADMIN to perform break-glass and security admin actions", () => {
    const adminPolicy = getRolePolicy("ADMIN");

    expect(adminPolicy.actions.activate_break_glass).toBe(true);
    expect(adminPolicy.actions.manage_users).toBe(true);
    expect(adminPolicy.actions.manage_passkeys).toBe(true);
    expect(adminPolicy.actions.clear_throttle).toBe(true);
    expect(adminPolicy.actions.unlock_staff).toBe(true);

    ROLE_POLICY_MATRIX.filter((policy) => policy.role !== "ADMIN").forEach((policy) => {
      HIGH_RISK_ACTIONS.forEach((action) => {
        expect(policy.actions[action]).toBe(false);
      });
    });
  });

  it("gives all clinical roles triage access but only admin and unit coordinator admin-route access", () => {
    const adminLikeRoles: StaffRole[] = ["ADMIN", "UNIT_COORDINATOR"];

    ROLE_POLICY_MATRIX.forEach((policy) => {
      expect(canRoleAccessRoute(policy.role, "/dashboard/triage")).toBe(true);
    });

    adminLikeRoles.forEach((role) => {
      expect(canRoleAccessRoute(role, "/dashboard/admin")).toBe(true);
    });

    ROLE_POLICY_MATRIX.filter((policy) => !adminLikeRoles.includes(policy.role)).forEach((policy) => {
      expect(canRoleAccessRoute(policy.role, "/dashboard/admin")).toBe(false);
    });
  });

  it("matches route policy expectations for each role", () => {
    expect(canRoleAccessRoute("DOCTOR", "/dashboard/or-scheduler")).toBe(true);
    expect(canRoleAccessRoute("SURGEON", "/dashboard/or-scheduler")).toBe(true);
    expect(canRoleAccessRoute("ANESTHESIOLOGIST", "/dashboard/or-scheduler")).toBe(true);
    expect(canRoleAccessRoute("SCRUB_TECH", "/dashboard/or-scheduler")).toBe(true);
    expect(canRoleAccessRoute("NURSE", "/dashboard/or-scheduler")).toBe(false);
    expect(canRoleAccessRoute("RAD_TECH", "/dashboard/admin")).toBe(false);
  });

  it("keeps the action matrix internally consistent", () => {
    ROLE_POLICY_MATRIX.forEach((policy) => {
      expect(canRoleAccessRoute(policy.role, "/dashboard/triage")).toBe(true);

      if (["DOCTOR", "SURGEON", "ANESTHESIOLOGIST", "SCRUB_TECH"].includes(policy.role)) {
        expect(canRoleAccessRoute(policy.role, "/dashboard/or-scheduler")).toBe(true);
      } else {
        expect(canRoleAccessRoute(policy.role, "/dashboard/or-scheduler")).toBe(false);
      }

      expect(canRolePerformAction(policy.role, "view_triage")).toBe(true);
      expect(canRolePerformAction(policy.role, "view_admin")).toBe(policy.role === "ADMIN" || policy.role === "UNIT_COORDINATOR");
    });
  });

  it("marks only high-risk admin actions as break-glass gated", () => {
    expect(actionRequiresBreakGlass("view_triage")).toBe(false);
    expect(actionRequiresBreakGlass("activate_break_glass")).toBe(false);

    HIGH_RISK_ACTIONS.forEach((action) => {
      expect(actionRequiresBreakGlass(action)).toBe(true);
    });
  });
});
