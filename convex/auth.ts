import { QueryCtx, MutationCtx } from "./_generated/server";

/**
 * Helper to ensure the user is logged in and has an appropriate clinical role.
 * This checks the publicMetadata set in the Clerk Dashboard.
 */
export const mustBeDoctor = async (ctx: MutationCtx | QueryCtx) => {
  const identity = await ctx.auth.getUserIdentity();

  if (!identity) {
    throw new Error("Unauthenticated: Please log in to perform this action.");
  }

  // Cast the role as a string to fix the Type Error
  const role = identity.role as string; 

  // Authorized roles list — admin has full clinical privileges
  const authorizedRoles = ["doctor", "staff", "nurse", "admin"];

  if (!role || !authorizedRoles.includes(role)) {
    throw new Error(`Unauthorized: Role '${role}' does not have permission to sign clinical notes.`);
  }

  return identity;
};

export const mustBeStaffOrDoctor = async (ctx: MutationCtx) => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");
  if (!identity.role) throw new Error("Requires staff or doctor role");
  if (!(identity.role === "doctor" || identity.role === "staff" || identity.role === "admin")) throw new Error("Requires staff or doctor role");
}

export const mustBeClinicAdmin = async (ctx: MutationCtx) => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");
  if (identity.role === "admin") return;
  const publicMeta = (identity as any).publicMetadata;
  if (publicMeta && publicMeta.clinicAdmin) return;
  throw new Error("Requires clinic admin role");
}

export const mustBeAdmin = async (ctx: MutationCtx | QueryCtx) => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error('Unauthenticated: Please log in.');
  const role = identity.role as string;
  if (role !== 'admin') throw new Error(`Unauthorized: admin role required.`);
  return identity;
};