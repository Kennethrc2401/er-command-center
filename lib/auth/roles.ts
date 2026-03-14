import type { StaffRole } from "@/lib/staffSessionToken";

export type ActorRole = StaffRole | "UNKNOWN";

const STAFF_ROLES: StaffRole[] = ["ADMIN", "DOCTOR", "NURSE", "CCMA"];

export function normalizeActorRole(value: unknown): ActorRole {
  if (typeof value !== "string") return "UNKNOWN";

  const normalized = value.toUpperCase();
  return STAFF_ROLES.includes(normalized as StaffRole) ? (normalized as StaffRole) : "UNKNOWN";
}

export function normalizeStaffRole(value: unknown, fallback: StaffRole = "NURSE"): StaffRole {
  const role = normalizeActorRole(value);
  return role === "UNKNOWN" ? fallback : role;
}

export function isAdminRole(value: unknown): boolean {
  return normalizeActorRole(value) === "ADMIN";
}
