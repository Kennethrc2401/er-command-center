const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const STAFF_SESSION_COOKIE = "staff_session";
export const STAFF_SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

export type StaffRole =
  | "ADMIN"
  | "DOCTOR"
  | "NURSE"
  | "CCMA"
  | "SURGEON"
  | "ANESTHESIOLOGIST"
  | "PHARMACIST"
  | "RESPIRATORY_THERAPIST"
  | "RAD_TECH"
  | "SCRUB_TECH"
  | "UNIT_COORDINATOR";

export type StaffSessionPayload = {
  userId: string;
  name: string;
  username: string;
  role: StaffRole;
  exp: number;
  iat: number;
};

const getSessionSecret = () => process.env.STAFF_AUTH_SESSION_SECRET ?? "dev-staff-session-secret-change-me";

const bytesToBase64 = (bytes: Uint8Array) => {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }

  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
};

const base64ToBytes = (base64: string) => {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(base64, "base64"));
  }

  const binary = atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};

const toBase64Url = (bytes: Uint8Array) =>
  bytesToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");

const fromBase64Url = (value: string) => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return base64ToBytes(padded);
};

const sign = async (payload: string, secret: string) => {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return toBase64Url(new Uint8Array(signature));
};

export const createStaffSessionToken = async (
  payload: Omit<StaffSessionPayload, "exp" | "iat">
) => {
  const now = Date.now();
  const tokenPayload: StaffSessionPayload = {
    ...payload,
    iat: now,
    exp: now + STAFF_SESSION_TTL_MS,
  };

  const encodedPayload = toBase64Url(encoder.encode(JSON.stringify(tokenPayload)));
  const signature = await sign(encodedPayload, getSessionSecret());
  return `${encodedPayload}.${signature}`;
};

export const verifyStaffSessionToken = async (token?: string | null): Promise<StaffSessionPayload | null> => {
  if (!token) return null;

  const [encodedPayload, providedSignature] = token.split(".");
  if (!encodedPayload || !providedSignature) return null;

  const expectedSignature = await sign(encodedPayload, getSessionSecret());
  if (providedSignature !== expectedSignature) return null;

  try {
    const payloadBytes = fromBase64Url(encodedPayload);
    const payload = JSON.parse(decoder.decode(payloadBytes)) as StaffSessionPayload;

    if (!payload.exp || payload.exp <= Date.now()) return null;
    if (!payload.userId || !payload.username || !payload.role) return null;

    return payload;
  } catch {
    return null;
  }
};
