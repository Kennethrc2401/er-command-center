import { describe, expect, it } from "vitest";
import { normalizePatientContactFields } from "./patientNormalization";

describe("normalizePatientContactFields", () => {
  it("normalizes phone and emergency contact phone to canonical format", () => {
    const result = normalizePatientContactFields({
      phoneNumber: " 206.555.1234 ",
      emergencyContactPhone: "1-425-555-0099",
    });

    expect(result.phoneNumber).toBe("(206) 555-1234");
    expect(result.emergencyContactPhone).toBe("(425) 555-0099");
  });

  it("normalizes email to lowercase and trims whitespace", () => {
    const result = normalizePatientContactFields({
      emailAddress: "  NURSE.TEST@EXAMPLE.ORG  ",
    });

    expect(result.emailAddress).toBe("nurse.test@example.org");
  });

  it("normalizes state and postal code into canonical forms", () => {
    const result = normalizePatientContactFields({
      state: " wa-  ",
      postalCode: "98101-9876 ",
    });

    expect(result.state).toBe("WA");
    expect(result.postalCode).toBe("98101-9876");
  });

  it("trims optional text fields and converts blank strings to undefined", () => {
    const result = normalizePatientContactFields({
      preferredLanguage: "  English ",
      addressLine1: "   ",
      city: " Seattle  ",
      emergencyContactRelation: "  Spouse ",
    });

    expect(result.preferredLanguage).toBe("English");
    expect(result.addressLine1).toBeUndefined();
    expect(result.city).toBe("Seattle");
    expect(result.emergencyContactRelation).toBe("Spouse");
  });

  it("preserves non-canonical phone/postal values when not enough digits", () => {
    const result = normalizePatientContactFields({
      phoneNumber: "12345",
      postalCode: "12",
    });

    expect(result.phoneNumber).toBe("12345");
    expect(result.postalCode).toBe("12");
  });
});
