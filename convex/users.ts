// convex/users.ts
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";

const userRoleValidator = v.union(
  v.literal("ADMIN"),
  v.literal("DOCTOR"),
  v.literal("NURSE"),
  v.literal("CCMA"),
  v.literal("SURGEON"),
  v.literal("ANESTHESIOLOGIST"),
  v.literal("PHARMACIST"),
  v.literal("RESPIRATORY_THERAPIST"),
  v.literal("RAD_TECH"),
  v.literal("SCRUB_TECH"),
  v.literal("UNIT_COORDINATOR")
);

const userStatusValidator = v.union(v.literal("ACTIVE"), v.literal("INACTIVE"));

const STAFF_HASH_PEPPER = process.env.STAFF_AUTH_HASH_PEPPER ?? "dev-staff-auth-pepper-change-me";
const HASH_PART_DELIMITER = ":";
const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const STAFF_LOCKOUT_DURATION_MS = 15 * 60 * 1000;
const STAFF_IP_WINDOW_MS = 10 * 60 * 1000;
const STAFF_IP_MAX_ATTEMPTS = 20;
const STAFF_IP_BLOCK_DURATION_MS = 10 * 60 * 1000;
const STAFF_IP_THROTTLE_RETENTION_MS = 24 * 60 * 60 * 1000;

const requireBreakGlassForAdmin = async (ctx: MutationCtx, actorUserId: Id<"users">) => {
  const actor = await ctx.db.get(actorUserId);
  if (!actor || actor.role !== "ADMIN" || actor.status !== "ACTIVE") {
    throw new Error("Only active ADMIN users can perform this action.");
  }

  const now = Date.now();
  const sessions = await ctx.db
    .query("breakGlassSessions")
    .withIndex("by_user_active", (q) => q.eq("userId", actorUserId).eq("isActive", true))
    .order("desc")
    .take(10);

  const activeSession = sessions.find((session) => session.expiresAt > now);
  if (!activeSession) {
    throw new Error("Break-glass access is required for this operation.");
  }

  return actor;
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();
const normalizeUsername = (username: string) => username.trim().toLowerCase();

const normalizeOptionalString = (value?: string) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const bytesToHex = (bytes: Uint8Array) =>
  Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

const randomSalt = () => {
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const salt = new Uint8Array(16);
    crypto.getRandomValues(salt);
    return bytesToHex(salt);
  }

  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().replace(/-/g, "");
  }

  const fallback = `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
  return fallback.slice(0, 32).padEnd(32, "0");
};

const hashSecret = async (rawValue: string, salt: string) => {
  const encoder = new TextEncoder();
  const secretMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(`${rawValue}|${STAFF_HASH_PEPPER}`),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: encoder.encode(salt),
      iterations: 210_000,
      hash: "SHA-256",
    },
    secretMaterial,
    256
  );

  return bytesToHex(new Uint8Array(derivedBits));
};

const createStoredHash = async (rawValue: string) => {
  const salt = randomSalt();
  const digest = await hashSecret(rawValue, salt);
  return `${salt}${HASH_PART_DELIMITER}${digest}`;
};

const verifyStoredHash = async (rawValue: string, storedHash?: string) => {
  if (!storedHash) return false;

  const [salt, expectedDigest] = storedHash.split(HASH_PART_DELIMITER);
  if (!salt || !expectedDigest) return false;

  const digest = await hashSecret(rawValue, salt);
  return digest === expectedDigest;
};

// listAll query to fetch all users
// 🔍 Add this query to fix the error
export const listAll = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db
      .query("users")
      .order("asc") // Sort alphabetically by name
      .collect();

    // Never return credential hashes to the client.
    return users.map((user) => {
      const sanitizedUser = { ...user } as Omit<typeof user, "passwordHash" | "officeKeyHash"> & {
        passwordHash?: string;
        officeKeyHash?: string;
      };

      delete sanitizedUser.passwordHash;
      delete sanitizedUser.officeKeyHash;
      return sanitizedUser;
    });
  },
});

export const getActiveRoster = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db
      .query("users")
      .collect();

    // Harden against legacy or malformed records in deployed environments.
    return users
      .filter((user) => user.status === "ACTIVE")
      .map((user) => {
        const safeName = typeof user.name === "string" ? user.name : "";
        const safeRole = typeof user.role === "string" ? user.role : "UNIT_COORDINATOR";
        const safeCredentials = typeof user.credentials === "string" ? user.credentials : "";
        const safeDepartment = typeof user.department === "string" ? user.department : "";
        const safeUsername = typeof user.username === "string" ? user.username : undefined;

        return {
          _id: user._id,
          name: safeName,
          role: safeRole,
          credentials: safeCredentials,
          department: safeDepartment,
          username: safeUsername,
        };
      })
      .filter((user) => user.name.length > 0)
      .sort((left, right) => left.role.localeCompare(right.role) || left.name.localeCompare(right.name));
  },
});

// Return providers for a clinic (doctors and other clinical roles)
export const listClinicProviders = query({
  args: { clinicId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const rows = await ctx.db.query("users").collect();
    const providerRoles = new Set(["DOCTOR", "SURGEON", "ANESTHESIOLOGIST", "PHARMACIST", "NURSE", "CCMA"]);
    return rows
      .filter((u) => u.status === "ACTIVE" && providerRoles.has(String(u.role)))
      .map((u) => ({
        _id: u._id,
        name: u.name,
        role: u.role,
        credentials: u.credentials ?? "",
        department: u.department ?? "",
        username: u.username ?? undefined,
        title: u.name,
      }))
      .sort((left, right) => String(left.role).localeCompare(String(right.role)) || String(left.name).localeCompare(String(right.name)));
  },
});

export const getByEmail = query({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const normalizedEmail = normalizeEmail(args.email);

    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .first();

    if (!user) return null;

    return {
      _id: user._id,
      name: user.name,
      role: user.role,
      status: user.status,
    };
  },
});

export const checkCreateUserConflicts = query({
  args: {
    email: v.optional(v.string()),
    username: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const email = normalizeOptionalString(args.email);
    const username = normalizeOptionalString(args.username);

    if (!email && !username) {
      return {
        emailExists: false,
        usernameExists: false,
      };
    }

    const normalizedEmail = email ? normalizeEmail(email) : undefined;
    const normalizedUsername = username ? normalizeUsername(username) : undefined;

    const [emailOwner, usernameOwner] = await Promise.all([
      normalizedEmail
        ? ctx.db
            .query("users")
            .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
            .first()
        : Promise.resolve(null),
      normalizedUsername
        ? ctx.db
            .query("users")
            .withIndex("by_username", (q) => q.eq("username", normalizedUsername))
            .first()
        : Promise.resolve(null),
    ]);

    return {
      emailExists: Boolean(emailOwner),
      usernameExists: Boolean(usernameOwner),
    };
  },
});

export const ensureUserProfile = mutation({
  args: {
    email: v.string(),
    name: v.optional(v.string()),
    role: v.optional(userRoleValidator),
    username: v.optional(v.string()),
    credentials: v.optional(v.string()),
    department: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const normalizedEmail = normalizeEmail(args.email);

    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .first();

    if (existing) {
      return {
        _id: existing._id,
        created: false,
      };
    }

    const requestedUsername = normalizeOptionalString(args.username);
    let normalizedUsername: string | undefined;

    if (requestedUsername) {
      const candidate = normalizeUsername(requestedUsername);
      const usernameOwner = await ctx.db
        .query("users")
        .withIndex("by_username", (q) => q.eq("username", candidate))
        .first();

      if (!usernameOwner) {
        normalizedUsername = candidate;
      }
    }

    const inferredName = normalizeOptionalString(args.name) ?? normalizedEmail.split("@")[0] ?? "Staff Member";
    const userId = await ctx.db.insert("users", {
      name: inferredName,
      email: normalizedEmail,
      username: normalizedUsername,
      role: args.role ?? "NURSE",
      credentials: normalizeOptionalString(args.credentials) ?? "Clinical Staff",
      department: normalizeOptionalString(args.department) ?? "Emergency Medicine",
      status: "ACTIVE",
      failedLoginAttempts: 0,
      lastFailedLoginAt: 0,
      lockedUntil: 0,
    });

    return {
      _id: userId,
      created: true,
    };
  },
});

export const getLockedStaffAccounts = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const users = await ctx.db.query("users").order("asc").collect();

    return users
      .filter((user) => (user.lockedUntil ?? 0) > now)
      .map((user) => ({
        _id: user._id,
        name: user.name,
        username: user.username ?? "",
        role: user.role,
        department: user.department,
        lockedUntil: user.lockedUntil ?? 0,
        lastFailedLoginAt: user.lastFailedLoginAt ?? 0,
      }));
  },
});

export const getRecentStaffThrottleActivity = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const limit = Math.max(1, Math.min(args.limit ?? 25, 100));

    const rows = await ctx.db
      .query("staffLoginThrottles")
      .withIndex("by_updatedAt")
      .order("desc")
      .take(limit);

    return rows.map((row) => ({
      _id: row._id,
      key: row.key,
      attemptCount: row.attemptCount,
      windowStartedAt: row.windowStartedAt,
      updatedAt: row.updatedAt,
      blockedUntil: row.blockedUntil ?? 0,
      isBlocked: (row.blockedUntil ?? 0) > now,
    }));
  },
});

export const createUser = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    role: userRoleValidator,
    credentials: v.string(),
    department: v.string(),
    npiNumber: v.optional(v.string()),
    username: v.string(),
    password: v.string(),
    officeKey: v.string(),
  },
  handler: async (ctx, args) => {
    const name = args.name.trim();
    const normalizedEmail = normalizeEmail(args.email);
    const normalizedUsername = normalizeUsername(args.username);
    const credentials = args.credentials.trim();
    const department = args.department.trim();

    if (!name) {
      return { ok: false as const, message: "Full name is required." };
    }

    if (!normalizedUsername) {
      return { ok: false as const, message: "Username is required." };
    }

    if (!credentials) {
      return { ok: false as const, message: "Credentials are required." };
    }

    if (!department) {
      return { ok: false as const, message: "Department is required." };
    }

    if (args.password.trim().length < 8) {
      return { ok: false as const, message: "Password must be at least 8 characters." };
    }

    if (args.officeKey.trim().length < 4) {
      return { ok: false as const, message: "Office key must be at least 4 characters." };
    }

    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .first();

    if (existingUser) {
      return { ok: false as const, message: "A user with this email already exists." };
    }

    const existingUsername = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", normalizedUsername))
      .first();

    if (existingUsername) {
      return { ok: false as const, message: "A user with this username already exists." };
    }

    let passwordHash: string;
    let officeKeyHash: string;

    try {
      [passwordHash, officeKeyHash] = await Promise.all([
        createStoredHash(args.password.trim()),
        createStoredHash(args.officeKey.trim()),
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown hashing error";
      return { ok: false as const, message: `Unable to secure staff credentials: ${message}` };
    }

    const userId = await ctx.db.insert("users", {
      name,
      email: normalizedEmail,
      username: normalizedUsername,
      role: args.role,
      credentials,
      department,
      passwordHash,
      officeKeyHash,
      credentialUpdatedAt: Date.now(),
      failedLoginAttempts: 0,
      lastFailedLoginAt: 0,
      lockedUntil: 0,
      npiNumber: normalizeOptionalString(args.npiNumber),
      status: "ACTIVE",
    });

    return {
      ok: true as const,
      userId,
    };
  },
});

export const updateUser = mutation({
  args: {
    id: v.id("users"),
    name: v.string(),
    email: v.string(),
    role: userRoleValidator,
    credentials: v.string(),
    department: v.string(),
    status: userStatusValidator,
    npiNumber: v.optional(v.string()),
    username: v.string(),
    newPassword: v.optional(v.string()),
    newOfficeKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const normalizedEmail = normalizeEmail(args.email);
    const normalizedUsername = normalizeUsername(args.username);

    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .first();

    if (existingUser && existingUser._id !== args.id) {
      throw new Error("A user with this email already exists.");
    }

    const existingUsername = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", normalizedUsername))
      .first();

    if (existingUsername && existingUsername._id !== args.id) {
      throw new Error("A user with this username already exists.");
    }

    const updates: {
      name: string;
      email: string;
      username: string;
      role: typeof args.role;
      credentials: string;
      department: string;
      status: typeof args.status;
      npiNumber?: string;
      passwordHash?: string;
      officeKeyHash?: string;
      credentialUpdatedAt?: number;
      failedLoginAttempts?: number;
      lastFailedLoginAt?: number;
      lockedUntil?: number;
    } = {
      name: args.name,
      email: normalizedEmail,
      username: normalizedUsername,
      role: args.role,
      credentials: args.credentials,
      department: args.department,
      status: args.status,
      npiNumber: normalizeOptionalString(args.npiNumber),
    };

    let credentialsUpdated = false;
    const nextPassword = args.newPassword?.trim();
    const nextOfficeKey = args.newOfficeKey?.trim();

    if (nextPassword) {
      if (nextPassword.length < 8) {
        throw new Error("New password must be at least 8 characters.");
      }
      updates.passwordHash = await createStoredHash(nextPassword);
      credentialsUpdated = true;
    }

    if (nextOfficeKey) {
      if (nextOfficeKey.length < 4) {
        throw new Error("New office key must be at least 4 characters.");
      }
      updates.officeKeyHash = await createStoredHash(nextOfficeKey);
      credentialsUpdated = true;
    }

    if (credentialsUpdated) {
      updates.credentialUpdatedAt = Date.now();
      updates.failedLoginAttempts = 0;
      updates.lastFailedLoginAt = 0;
      updates.lockedUntil = 0;
    }

    await ctx.db.patch(args.id, updates);
  },
});

export const updateUserRole = mutation({
  args: { id: v.id("users"), role: userRoleValidator },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { role: args.role });
  },
});

export const deleteUser = mutation({
  args: { id: v.id("users") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

export const unlockStaffAccount = mutation({
  args: {
    actorUserId: v.id("users"),
    id: v.id("users"),
  },
  handler: async (ctx, args) => {
    const actor = await requireBreakGlassForAdmin(ctx, args.actorUserId);

    const user = await ctx.db.get(args.id);
    if (!user) {
      throw new Error("User not found.");
    }

    await ctx.db.patch(args.id, {
      failedLoginAttempts: 0,
      lastFailedLoginAt: 0,
      lockedUntil: 0,
    });

    await ctx.db.insert("auditLogs", {
      userId: args.actorUserId,
      userName: actor.name,
      action: "STAFF_ACCOUNT_UNLOCKED",
      patientName: "Security Admin",
      timestamp: Date.now(),
      metadata: `TargetUser=${user.name}; username=${user.username ?? "unset"}`,
    });

    return { success: true };
  },
});

export const getStaffAuthUserByUsername = query({
  args: {
    username: v.string(),
  },
  handler: async (ctx, args) => {
    const normalizedUsername = normalizeUsername(args.username);
    const user = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", normalizedUsername))
      .first();

    if (!user) return null;

    return {
      userId: user._id,
      name: user.name,
      username: user.username ?? normalizedUsername,
      role: user.role,
      status: user.status,
      lockedUntil: user.lockedUntil ?? 0,
    };
  },
});

export const getStaffAuthUserById = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;

    return {
      userId: user._id,
      name: user.name,
      username: user.username ?? "",
      role: user.role,
      status: user.status,
      lockedUntil: user.lockedUntil ?? 0,
    };
  },
});

export const recordStaffLoginFailure = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || user.status !== "ACTIVE") {
      return {
        locked: false,
        retryAfterMinutes: 0,
      };
    }

    const now = Date.now();
    const failedAttempts = (user.failedLoginAttempts ?? 0) + 1;
    const shouldLock = failedAttempts >= MAX_FAILED_LOGIN_ATTEMPTS;

    await ctx.db.patch(user._id, {
      failedLoginAttempts: shouldLock ? 0 : failedAttempts,
      lastFailedLoginAt: now,
      lockedUntil: shouldLock ? now + STAFF_LOCKOUT_DURATION_MS : 0,
    });

    return {
      locked: shouldLock,
      retryAfterMinutes: shouldLock ? Math.max(1, Math.ceil(STAFF_LOCKOUT_DURATION_MS / 60000)) : 0,
    };
  },
});

export const recordStaffLoginSuccess = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return;

    await ctx.db.patch(user._id, {
      failedLoginAttempts: 0,
      lastFailedLoginAt: 0,
      lockedUntil: 0,
    });
  },
});

export const consumeStaffIpRateLimit = mutation({
  args: {
    key: v.string(),
  },
  handler: async (ctx, args) => {
    const key = args.key.trim().toLowerCase();
    if (!key) {
      throw new Error("Rate-limit key is required.");
    }

    const now = Date.now();
    const existing = await ctx.db
      .query("staffLoginThrottles")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();

    if (!existing) {
      await ctx.db.insert("staffLoginThrottles", {
        key,
        attemptCount: 1,
        windowStartedAt: now,
        blockedUntil: 0,
        updatedAt: now,
      });

      return {
        allowed: true,
        remainingAttempts: STAFF_IP_MAX_ATTEMPTS - 1,
        retryAfterSeconds: 0,
      };
    }

    if ((existing.blockedUntil ?? 0) > now) {
      return {
        allowed: false,
        remainingAttempts: 0,
        retryAfterSeconds: Math.max(1, Math.ceil(((existing.blockedUntil ?? 0) - now) / 1000)),
      };
    }

    let nextAttemptCount = existing.attemptCount;
    let nextWindowStartedAt = existing.windowStartedAt;

    if (now - existing.windowStartedAt > STAFF_IP_WINDOW_MS) {
      nextAttemptCount = 0;
      nextWindowStartedAt = now;
    }

    nextAttemptCount += 1;
    const shouldBlock = nextAttemptCount > STAFF_IP_MAX_ATTEMPTS;
    const blockedUntil = shouldBlock ? now + STAFF_IP_BLOCK_DURATION_MS : 0;

    await ctx.db.patch(existing._id, {
      attemptCount: nextAttemptCount,
      windowStartedAt: nextWindowStartedAt,
      blockedUntil,
      updatedAt: now,
    });

    if (shouldBlock) {
      return {
        allowed: false,
        remainingAttempts: 0,
        retryAfterSeconds: Math.max(1, Math.ceil(STAFF_IP_BLOCK_DURATION_MS / 1000)),
      };
    }

    return {
      allowed: true,
      remainingAttempts: Math.max(0, STAFF_IP_MAX_ATTEMPTS - nextAttemptCount),
      retryAfterSeconds: 0,
    };
  },
});

export const clearStaffIpRateLimit = mutation({
  args: {
    key: v.string(),
  },
  handler: async (ctx, args) => {
    const key = args.key.trim().toLowerCase();
    if (!key) return;

    const existing = await ctx.db
      .query("staffLoginThrottles")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

export const clearStaffIpRateLimitAdmin = mutation({
  args: {
    actorUserId: v.id("users"),
    key: v.string(),
  },
  handler: async (ctx, args) => {
    const actor = await requireBreakGlassForAdmin(ctx, args.actorUserId);

    const key = args.key.trim().toLowerCase();
    if (!key) return;

    const existing = await ctx.db
      .query("staffLoginThrottles")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
    }

    await ctx.db.insert("auditLogs", {
      userId: args.actorUserId,
      userName: actor.name,
      action: "STAFF_THROTTLE_CLEARED",
      patientName: "Security Admin",
      timestamp: Date.now(),
      metadata: `Key=${key}`,
    });
  },
});

export const pruneStaleStaffIpThrottles = mutation({
  args: {
    nowTs: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = args.nowTs ?? Date.now();
    const batchLimit = Math.max(1, Math.min(args.limit ?? 25, 100));
    const cutoff = now - STAFF_IP_THROTTLE_RETENTION_MS;

    const staleRows = await ctx.db
      .query("staffLoginThrottles")
      .withIndex("by_updatedAt", (q) => q.lt("updatedAt", cutoff))
      .take(batchLimit);

    for (const row of staleRows) {
      await ctx.db.delete(row._id);
    }

    return { deletedCount: staleRows.length };
  },
});

export const verifyStaffCredentials = mutation({
  args: {
    username: v.string(),
    password: v.string(),
    officeKey: v.string(),
  },
  handler: async (ctx, args) => {
    const normalizedUsername = normalizeUsername(args.username);
    const now = Date.now();
    const user = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", normalizedUsername))
      .first();

    if (!user || user.status !== "ACTIVE") {
      throw new Error("Invalid staff credentials.");
    }

    if ((user.lockedUntil ?? 0) > now) {
      const minutesRemaining = Math.max(1, Math.ceil(((user.lockedUntil ?? 0) - now) / 60000));
      throw new Error(
        `Account locked due to repeated failed attempts. Try again in ${minutesRemaining} minute${minutesRemaining === 1 ? "" : "s"}.`
      );
    }

    const [isPasswordValid, isOfficeKeyValid] = await Promise.all([
      verifyStoredHash(args.password.trim(), user.passwordHash),
      verifyStoredHash(args.officeKey.trim(), user.officeKeyHash),
    ]);

    if (!isPasswordValid || !isOfficeKeyValid) {
      const failedAttempts = (user.failedLoginAttempts ?? 0) + 1;
      const shouldLock = failedAttempts >= MAX_FAILED_LOGIN_ATTEMPTS;

      await ctx.db.patch(user._id, {
        failedLoginAttempts: shouldLock ? 0 : failedAttempts,
        lastFailedLoginAt: now,
        lockedUntil: shouldLock ? now + STAFF_LOCKOUT_DURATION_MS : 0,
      });

      if (shouldLock) {
        throw new Error("Too many failed attempts. Account locked for 15 minutes.");
      }

      throw new Error("Invalid staff credentials.");
    }

    await ctx.db.patch(user._id, {
      failedLoginAttempts: 0,
      lastFailedLoginAt: 0,
      lockedUntil: 0,
    });

    return {
      userId: user._id,
      name: user.name,
      username: user.username ?? normalizedUsername,
      role: user.role,
      department: user.department,
    };
  },
});

export const resetPasswordWithOfficeKey = mutation({
  args: {
    username: v.string(),
    officeKey: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, args) => {
    const normalizedUsername = normalizeUsername(args.username);
    const user = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", normalizedUsername))
      .first();

    if (!user || user.status !== "ACTIVE") {
      throw new Error("Unable to reset password. Check your credentials.");
    }

    const officeKeyValid = await verifyStoredHash(args.officeKey.trim(), user.officeKeyHash);
    if (!officeKeyValid) {
      throw new Error("Unable to reset password. Check your credentials.");
    }

    const newPassword = args.newPassword.trim();
    if (newPassword.length < 8) {
      throw new Error("New password must be at least 8 characters.");
    }

    await ctx.db.patch(user._id, {
      passwordHash: await createStoredHash(newPassword),
      credentialUpdatedAt: Date.now(),
      failedLoginAttempts: 0,
      lastFailedLoginAt: 0,
      lockedUntil: 0,
    });

    return { success: true };
  },
});