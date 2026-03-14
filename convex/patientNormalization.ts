type OptionalString = string | undefined;

export type PatientContactInput = {
  phoneNumber?: string;
  emailAddress?: string;
  preferredLanguage?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;
};

function trimOptional(value: OptionalString): OptionalString {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizePhone(value: OptionalString): OptionalString {
  const trimmed = trimOptional(value);
  if (!trimmed) return undefined;

  const digitsOnly = trimmed.replace(/\D/g, "");
  const tenDigit = digitsOnly.length === 11 && digitsOnly.startsWith("1")
    ? digitsOnly.slice(1)
    : digitsOnly;

  if (tenDigit.length === 10) {
    return `(${tenDigit.slice(0, 3)}) ${tenDigit.slice(3, 6)}-${tenDigit.slice(6)}`;
  }

  return trimmed;
}

function normalizeEmail(value: OptionalString): OptionalString {
  const trimmed = trimOptional(value);
  return trimmed ? trimmed.toLowerCase() : undefined;
}

function normalizeState(value: OptionalString): OptionalString {
  const trimmed = trimOptional(value);
  if (!trimmed) return undefined;

  const lettersOnly = trimmed.replace(/[^a-z]/gi, "").toUpperCase();
  if (!lettersOnly) return trimmed;
  return lettersOnly.slice(0, 2);
}

function normalizePostalCode(value: OptionalString): OptionalString {
  const trimmed = trimOptional(value);
  if (!trimmed) return undefined;

  const digitsOnly = trimmed.replace(/\D/g, "");
  if (digitsOnly.length >= 9) {
    const firstNine = digitsOnly.slice(0, 9);
    return `${firstNine.slice(0, 5)}-${firstNine.slice(5)}`;
  }
  if (digitsOnly.length >= 5) {
    return digitsOnly.slice(0, 5);
  }

  return trimmed;
}

export function normalizePatientContactFields(input: PatientContactInput): PatientContactInput {
  return {
    phoneNumber: normalizePhone(input.phoneNumber),
    emailAddress: normalizeEmail(input.emailAddress),
    preferredLanguage: trimOptional(input.preferredLanguage),
    addressLine1: trimOptional(input.addressLine1),
    addressLine2: trimOptional(input.addressLine2),
    city: trimOptional(input.city),
    state: normalizeState(input.state),
    postalCode: normalizePostalCode(input.postalCode),
    emergencyContactName: trimOptional(input.emergencyContactName),
    emergencyContactPhone: normalizePhone(input.emergencyContactPhone),
    emergencyContactRelation: trimOptional(input.emergencyContactRelation),
  };
}
