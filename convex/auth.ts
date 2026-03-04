import { v } from "convex/values";
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

  // Authorized roles list
  const authorizedRoles = ["doctor", "staff", "nurse"];

  if (!role || !authorizedRoles.includes(role)) {
    throw new Error(`Unauthorized: Role '${role}' does not have permission to sign clinical notes.`);
  }

  return identity;
};