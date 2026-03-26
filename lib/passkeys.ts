const PASSKEY_DEFAULT_ORIGIN =
  process.env.NEXT_PUBLIC_APP_ORIGIN ??
  process.env.NEXT_PUBLIC_SITE_URL ??
  "http://localhost:3000";

const normalizeOrigin = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return `https://${trimmed}`;
};

const getNormalizedDefaultOrigin = (runtimeOrigin?: string) =>
  normalizeOrigin(runtimeOrigin || PASSKEY_DEFAULT_ORIGIN);

export const getPasskeyRpId = (runtimeOrigin?: string) => {
  const configured = process.env.PASSKEY_RP_ID?.trim();
  if (configured) return configured;

  const origin = getNormalizedDefaultOrigin(runtimeOrigin);
  try {
    return new URL(origin).hostname;
  } catch {
    return "localhost";
  }
};

export const getPasskeyRpName = () => process.env.PASSKEY_RP_NAME?.trim() || "Nexus ER Triage";

export const getPasskeyExpectedOrigins = (runtimeOrigin?: string) => {
  const configured = process.env.PASSKEY_ALLOWED_ORIGINS
    ?.split(",")
    .map(normalizeOrigin)
    .filter(Boolean);

  if (configured && configured.length > 0) {
    return configured;
  }

  return [getNormalizedDefaultOrigin(runtimeOrigin)];
};
