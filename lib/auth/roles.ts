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

  const normalized = value.trim().toUpperCase();
  if (normalized === "ADMINISTRATOR") return "ADMIN";
  if (normalized === "UNIT COORDINATOR") return "UNIT_COORDINATOR";
  if (normalized === "RN") return "NURSE";
  if (normalized === "MD") return "DOCTOR";
  if (normalized === "PHYSICIAN") return "DOCTOR";
  if (normalized === "RT") return "RESPIRATORY_THERAPIST";
  if (normalized === "RESPIRATORY THERAPIST") return "RESPIRATORY_THERAPIST";
  if (normalized === "RAD TECH" || normalized === "RADIOLOGY TECH") return "RAD_TECH";
  if (normalized === "RADIOLOGIC TECHNOLOGIST") return "RAD_TECH";
  if (normalized === "SCRUB TECH") return "SCRUB_TECH";
  if (normalized === "SURGICAL TECHNOLOGIST") return "SCRUB_TECH";
  if (normalized === "CCMA" || normalized === "MA") return "CCMA";

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

export type PolicyActionKey =
  | "view_triage"
  | "view_admin"
  | "manage_users"
  | "manage_passkeys"
  | "clear_throttle"
  | "unlock_staff"
  | "activate_break_glass";

const BREAK_GLASS_REQUIRED_ACTIONS: PolicyActionKey[] = [
  "manage_users",
  "manage_passkeys",
  "clear_throttle",
  "unlock_staff",
];

export type RolePolicy = {
  role: StaffRole;
  label: string;
  routes: string[];
  actions: Record<PolicyActionKey, boolean>;
  notes?: string;
};

export const ROLE_POLICY_MATRIX: RolePolicy[] = [
  {
    role: "ADMIN",
    label: "Administrator",
    routes: ["/dashboard/triage", "/dashboard/admin"],
    actions: {
      view_triage: true,
      view_admin: true,
      manage_users: true,
      manage_passkeys: true,
      clear_throttle: true,
      unlock_staff: true,
      activate_break_glass: true,
    },
    notes: "Full operational access; high-risk actions require active Break-Glass.",
  },
  {
    role: "DOCTOR",
    label: "Physician",
    routes: ["/dashboard/triage", "/dashboard/or-scheduler"],
    actions: {
      view_triage: true,
      view_admin: false,
      manage_users: false,
      manage_passkeys: false,
      clear_throttle: false,
      unlock_staff: false,
      activate_break_glass: false,
    },
    notes: "Clinical workflow access; no admin controls.",
  },
  {
    role: "SURGEON",
    label: "Surgeon",
    routes: ["/dashboard/triage", "/dashboard/or-scheduler"],
    actions: {
      view_triage: true,
      view_admin: false,
      manage_users: false,
      manage_passkeys: false,
      clear_throttle: false,
      unlock_staff: false,
      activate_break_glass: false,
    },
    notes: "OR-facing clinical access only.",
  },
  {
    role: "ANESTHESIOLOGIST",
    label: "Anesthesiologist",
    routes: ["/dashboard/triage", "/dashboard/or-scheduler"],
    actions: {
      view_triage: true,
      view_admin: false,
      manage_users: false,
      manage_passkeys: false,
      clear_throttle: false,
      unlock_staff: false,
      activate_break_glass: false,
    },
    notes: "Clinical OR support access only.",
  },
  {
    role: "NURSE",
    label: "Nurse",
    routes: ["/dashboard/triage"],
    actions: {
      view_triage: true,
      view_admin: false,
      manage_users: false,
      manage_passkeys: false,
      clear_throttle: false,
      unlock_staff: false,
      activate_break_glass: false,
    },
  },
  {
    role: "CCMA",
    label: "CCMA",
    routes: ["/dashboard/triage"],
    actions: {
      view_triage: true,
      view_admin: false,
      manage_users: false,
      manage_passkeys: false,
      clear_throttle: false,
      unlock_staff: false,
      activate_break_glass: false,
    },
  },
  {
    role: "PHARMACIST",
    label: "Pharmacist",
    routes: ["/dashboard/triage"],
    actions: {
      view_triage: true,
      view_admin: false,
      manage_users: false,
      manage_passkeys: false,
      clear_throttle: false,
      unlock_staff: false,
      activate_break_glass: false,
    },
  },
  {
    role: "RESPIRATORY_THERAPIST",
    label: "Respiratory Therapist",
    routes: ["/dashboard/triage"],
    actions: {
      view_triage: true,
      view_admin: false,
      manage_users: false,
      manage_passkeys: false,
      clear_throttle: false,
      unlock_staff: false,
      activate_break_glass: false,
    },
  },
  {
    role: "RAD_TECH",
    label: "Radiology Tech",
    routes: ["/dashboard/triage"],
    actions: {
      view_triage: true,
      view_admin: false,
      manage_users: false,
      manage_passkeys: false,
      clear_throttle: false,
      unlock_staff: false,
      activate_break_glass: false,
    },
  },
  {
    role: "SCRUB_TECH",
    label: "Scrub Tech",
    routes: ["/dashboard/triage", "/dashboard/or-scheduler"],
    actions: {
      view_triage: true,
      view_admin: false,
      manage_users: false,
      manage_passkeys: false,
      clear_throttle: false,
      unlock_staff: false,
      activate_break_glass: false,
    },
  },
  {
    role: "UNIT_COORDINATOR",
    label: "Unit Coordinator",
    routes: ["/dashboard/triage", "/dashboard/admin"],
    actions: {
      view_triage: true,
      view_admin: true,
      manage_users: false,
      manage_passkeys: false,
      clear_throttle: false,
      unlock_staff: false,
      activate_break_glass: false,
    },
    notes: "Operational oversight; admin UI visibility without privileged controls.",
  },
];

export function getRolePolicy(role: StaffRole): RolePolicy {
  return ROLE_POLICY_MATRIX.find((policy) => policy.role === role) ?? ROLE_POLICY_MATRIX[0];
}

export function canRoleAccessRoute(role: StaffRole, route: string): boolean {
  const policy = getRolePolicy(role);
  return policy.routes.some((allowedRoute) => route.startsWith(allowedRoute));
}

export function canRolePerformAction(role: StaffRole, action: PolicyActionKey): boolean {
  return getRolePolicy(role).actions[action];
}

export function actionRequiresBreakGlass(action: PolicyActionKey): boolean {
  return BREAK_GLASS_REQUIRED_ACTIONS.includes(action);
}
