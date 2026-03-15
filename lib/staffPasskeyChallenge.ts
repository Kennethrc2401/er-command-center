const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const STAFF_PASSKEY_CHALLENGE_COOKIE = "staff_passkey_challenge";
export const STAFF_PASSKEY_CHALLENGE_TTL_MS = 1000 * 60 * 5;

export type StaffPasskeyChallengeType = "registration" | "authentication";

export type StaffPasskeyChallengePayload = {
  challenge: string;
  type: StaffPasskeyChallengeType;
  userId: string;
  username: string;
  ipKey: string;
  exp: number;
  iat: number;
};

const getChallengeSecret = () =>
  process.env.STAFF_PASSKEY_CHALLENGE_SECRET ?? "dev-staff-passkey-challenge-secret-change-me";

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

export const createStaffPasskeyChallengeToken = async (
  payload: Omit<StaffPasskeyChallengePayload, "exp" | "iat">,
  ttlMs: number = STAFF_PASSKEY_CHALLENGE_TTL_MS
) => {
  const now = Date.now();
  const tokenPayload: StaffPasskeyChallengePayload = {
    ...payload,
    iat: now,
    exp: now + ttlMs,
  };

  const encodedPayload = toBase64Url(encoder.encode(JSON.stringify(tokenPayload)));
  const signature = await sign(encodedPayload, getChallengeSecret());
  return `${encodedPayload}.${signature}`;
};

export const verifyStaffPasskeyChallengeToken = async (
  token?: string | null
): Promise<StaffPasskeyChallengePayload | null> => {
  if (!token) return null;

  const [encodedPayload, providedSignature] = token.split(".");
  if (!encodedPayload || !providedSignature) return null;

  const expectedSignature = await sign(encodedPayload, getChallengeSecret());
  if (providedSignature !== expectedSignature) return null;

  try {
    const payloadBytes = fromBase64Url(encodedPayload);
    const payload = JSON.parse(decoder.decode(payloadBytes)) as StaffPasskeyChallengePayload;

    if (!payload.exp || payload.exp <= Date.now()) return null;
    if (!payload.challenge || !payload.type || !payload.userId || !payload.username) return null;

    return payload;
  } catch {
    return null;
  }
};
