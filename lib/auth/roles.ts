import type { StaffRole } from "@/lib/staffSessionToken";

export type ActorRole = StaffRole | "UNKNOWN";

export const STAFF_ROLES: StaffRole[] = [
  "ADMIN",
  "DOCTOR",
  "NURSE",
  "CCMA",
  "SURGEON",
  "ANESTHESIOLOGIST",
  "PHARMACIST",
  "RESPIRATORY_THERAPIST",
  "RAD_TECH",
  "SCRUB_TECH",
  "UNIT_COORDINATOR",
];

const ROLE_DEFAULT_CREDENTIALS: Record<StaffRole, string> = {
  ADMIN: "Admin",
  DOCTOR: "MD",
  NURSE: "RN",
  CCMA: "CCMA",
  SURGEON: "MD, FACS",
  ANESTHESIOLOGIST: "MD",
  PHARMACIST: "PharmD",
  RESPIRATORY_THERAPIST: "RRT",
  RAD_TECH: "RT(R)",
  SCRUB_TECH: "CST",
  UNIT_COORDINATOR: "Unit Coordinator",
};

export function normalizeActorRole(value: unknown): ActorRole {
  if (typeof value !== "string") return "UNKNOWN";

  const normalized = value.toUpperCase();
  return STAFF_ROLES.includes(normalized as StaffRole) ? (normalized as StaffRole) : "UNKNOWN";
}

export function normalizeStaffRole(value: unknown, fallback: StaffRole = "NURSE"): StaffRole {
  const role = normalizeActorRole(value);
  return role === "UNKNOWN" ? fallback : role;
}

export function defaultCredentialsForRole(role: StaffRole): string {
  return ROLE_DEFAULT_CREDENTIALS[role];
}

export function isAdminRole(value: unknown): boolean {
  return normalizeActorRole(value) === "ADMIN";
}
