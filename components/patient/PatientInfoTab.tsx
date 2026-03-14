"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Copy, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";

type PatientInfoRecord = {
  name: string;
  mrn: string;
  dob: string;
  gender: string;
  allergies: string[];
  codeStatus?: string;
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

type SocialHistoryRecord = {
  smokingStatus: string;
  livingSituation: string;
  alcoholUse: string;
};

type EditableInfo = {
  name: string;
  dob: string;
  gender: string;
  allergiesText: string;
  smokingStatus: string;
  livingSituation: string;
  alcoholUse: string;
  phoneNumber: string;
  emailAddress: string;
  preferredLanguage: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;
};

function toSafeString(value: unknown) {
  return typeof value === "string" ? value : "";
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  const success = document.execCommand("copy");
  document.body.removeChild(textArea);

  if (!success) {
    throw new Error("Unable to copy to clipboard");
  }
}

function formatAddress(values: EditableInfo) {
  const line2 = values.addressLine2.trim();
  const cityStateZip = [values.city.trim(), values.state.trim(), values.postalCode.trim()].filter(Boolean).join(", ");

  return [values.addressLine1.trim(), line2, cityStateZip].filter(Boolean).join("\n") || "Not documented";
}

function formatPhoneInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 10);

  if (digits.length < 4) return digits;
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function formatPostalInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 9);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function normalizeStateInput(value: string) {
  return value.replace(/[^a-z]/gi, "").toUpperCase().slice(0, 2);
}

function emailLooksValid(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validateEditableInfo(values: EditableInfo) {
  const errors: Partial<Record<keyof EditableInfo, string>> = {};

  const phoneDigits = values.phoneNumber.replace(/\D/g, "");
  if (phoneDigits.length > 0 && phoneDigits.length !== 10) {
    errors.phoneNumber = "Phone must be 10 digits.";
  }

  const emergencyPhoneDigits = values.emergencyContactPhone.replace(/\D/g, "");
  if (emergencyPhoneDigits.length > 0 && emergencyPhoneDigits.length !== 10) {
    errors.emergencyContactPhone = "Emergency phone must be 10 digits.";
  }

  const email = values.emailAddress.trim();
  if (email.length > 0 && !emailLooksValid(email)) {
    errors.emailAddress = "Enter a valid email address.";
  }

  const state = values.state.trim();
  if (state.length > 0 && !/^[A-Z]{2}$/.test(state)) {
    errors.state = "State must be a 2-letter code.";
  }

  const postal = values.postalCode.trim();
  if (postal.length > 0 && !/^\d{5}(-\d{4})?$/.test(postal)) {
    errors.postalCode = "Postal code must be 5 digits or ZIP+4.";
  }

  return errors;
}

function parseAllergiesInput(value: string) {
  const tokens = value
    .split(/[\n,;]+/)
    .map((token) => token.trim())
    .filter(Boolean);

  return Array.from(new Set(tokens));
}

function buildEditableInfo(patient: PatientInfoRecord, social?: SocialHistoryRecord | null): EditableInfo {
  return {
    name: toSafeString(patient.name),
    dob: toSafeString(patient.dob),
    gender: toSafeString(patient.gender),
    allergiesText: patient.allergies.join(", "),
    smokingStatus: toSafeString(social?.smokingStatus),
    livingSituation: toSafeString(social?.livingSituation),
    alcoholUse: toSafeString(social?.alcoholUse),
    phoneNumber: formatPhoneInput(toSafeString((patient as Record<string, unknown>).phoneNumber)),
    emailAddress: toSafeString((patient as Record<string, unknown>).emailAddress),
    preferredLanguage: toSafeString((patient as Record<string, unknown>).preferredLanguage),
    addressLine1: toSafeString((patient as Record<string, unknown>).addressLine1),
    addressLine2: toSafeString((patient as Record<string, unknown>).addressLine2),
    city: toSafeString((patient as Record<string, unknown>).city),
    state: normalizeStateInput(toSafeString((patient as Record<string, unknown>).state)),
    postalCode: formatPostalInput(toSafeString((patient as Record<string, unknown>).postalCode)),
    emergencyContactName: toSafeString((patient as Record<string, unknown>).emergencyContactName),
    emergencyContactPhone: formatPhoneInput(toSafeString((patient as Record<string, unknown>).emergencyContactPhone)),
    emergencyContactRelation: toSafeString((patient as Record<string, unknown>).emergencyContactRelation),
  };
}

function areEditableInfoEqual(left: EditableInfo, right: EditableInfo) {
  return (
    left.name === right.name &&
    left.dob === right.dob &&
    left.gender === right.gender &&
    left.allergiesText === right.allergiesText &&
    left.smokingStatus === right.smokingStatus &&
    left.livingSituation === right.livingSituation &&
    left.alcoholUse === right.alcoholUse &&
    left.phoneNumber === right.phoneNumber &&
    left.emailAddress === right.emailAddress &&
    left.preferredLanguage === right.preferredLanguage &&
    left.addressLine1 === right.addressLine1 &&
    left.addressLine2 === right.addressLine2 &&
    left.city === right.city &&
    left.state === right.state &&
    left.postalCode === right.postalCode &&
    left.emergencyContactName === right.emergencyContactName &&
    left.emergencyContactPhone === right.emergencyContactPhone &&
    left.emergencyContactRelation === right.emergencyContactRelation
  );
}

export default function PatientInfoTab({
  patientId,
  patient,
}: {
  patientId: Id<"patients">;
  patient: PatientInfoRecord;
}) {
  const updateDemographics = useMutation(api.patients.updateDemographics);
  const updateSocialHistory = useMutation(api.socialHistory.update);
  const social = useQuery(api.socialHistory.getByPatient, { patientId }) as SocialHistoryRecord | null | undefined;
  const initialForm = useMemo(() => buildEditableInfo(patient, social), [patient, social]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<EditableInfo>(initialForm);
  const [savedSnapshot, setSavedSnapshot] = useState<EditableInfo>(initialForm);

  useEffect(() => {
    setForm(initialForm);
    setSavedSnapshot(initialForm);
  }, [initialForm]);

  const validationErrors = useMemo(() => validateEditableInfo(form), [form]);
  const hasValidationErrors = Object.keys(validationErrors).length > 0;
  const parsedAllergies = useMemo(() => parseAllergiesInput(form.allergiesText), [form.allergiesText]);
  const hasUnsavedChanges = useMemo(() => !areEditableInfoEqual(form, savedSnapshot), [form, savedSnapshot]);

  const identityText = useMemo(
    () =>
      [
        `Name: ${form.name.trim() || patient.name}`,
        `MRN: ${patient.mrn}`,
        `DOB: ${form.dob || patient.dob || "N/A"}`,
        `Gender: ${form.gender || patient.gender || "N/A"}`,
        `Code Status: ${patient.codeStatus || "Full Code"}`,
      ].join("\n"),
    [patient, form.name, form.dob, form.gender]
  );

  const contactText = useMemo(
    () =>
      [
        `Phone: ${form.phoneNumber.trim() || "Not documented"}`,
        `Email: ${form.emailAddress.trim() || "Not documented"}`,
        `Preferred Language: ${form.preferredLanguage.trim() || "Not documented"}`,
      ].join("\n"),
    [form.phoneNumber, form.emailAddress, form.preferredLanguage]
  );

  const emergencyText = useMemo(
    () =>
      [
        `Contact Name: ${form.emergencyContactName.trim() || "Not documented"}`,
        `Contact Phone: ${form.emergencyContactPhone.trim() || "Not documented"}`,
        `Relation: ${form.emergencyContactRelation.trim() || "Not documented"}`,
      ].join("\n"),
    [form.emergencyContactName, form.emergencyContactPhone, form.emergencyContactRelation]
  );

  const socialText = useMemo(
    () =>
      [
        `Living Situation: ${form.livingSituation.trim() || "Not documented"}`,
        `Smoking Status: ${form.smokingStatus.trim() || "Unknown"}`,
        `Alcohol Use: ${form.alcoholUse.trim() || "Unknown"}`,
      ].join("\n"),
    [form.livingSituation, form.smokingStatus, form.alcoholUse]
  );

  const clinicalText = useMemo(
    () =>
      [
        `Allergies: ${parsedAllergies.length > 0 ? parsedAllergies.join(", ") : "No known allergies"}`,
        `Code Status: ${patient.codeStatus || "Full Code"}`,
      ].join("\n"),
    [parsedAllergies, patient.codeStatus]
  );

  const copySection = async (label: string, content: string) => {
    try {
      await copyText(content);
      toast.success(`${label} copied.`);
    } catch {
      toast.error(`Unable to copy ${label.toLowerCase()}.`);
    }
  };

  const saveInfo = async () => {
    if (hasValidationErrors) {
      toast.error("Please resolve validation errors before saving.");
      return;
    }

    setSaving(true);
    try {
      await Promise.all([
        updateDemographics({
          patientId,
          name: form.name,
          dob: form.dob,
          gender: form.gender,
          allergies: parsedAllergies,
          phoneNumber: form.phoneNumber,
          emailAddress: form.emailAddress,
          preferredLanguage: form.preferredLanguage,
          addressLine1: form.addressLine1,
          addressLine2: form.addressLine2,
          city: form.city,
          state: form.state,
          postalCode: form.postalCode,
          emergencyContactName: form.emergencyContactName,
          emergencyContactPhone: form.emergencyContactPhone,
          emergencyContactRelation: form.emergencyContactRelation,
        }),
        updateSocialHistory({
          patientId,
          smokingStatus: form.smokingStatus.trim() || "Unknown",
          livingSituation: form.livingSituation.trim() || "Not Documented",
          alcoholUse: form.alcoholUse.trim() || "Unknown",
        }),
      ]);
      setSavedSnapshot(form);
      toast.success("Patient info updated.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update patient info.";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const revertChanges = () => {
    if (!hasUnsavedChanges) return;
    setForm(savedSnapshot);
    toast.success("Reverted unsaved changes.");
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className="rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-300">
              Identity
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => copySection("Identity", identityText)} className="h-7 gap-1 text-[9px] font-black uppercase text-blue-600">
              <Copy className="h-3.5 w-3.5" /> Copy
            </Button>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="Full Name" value={form.name} onChange={(value) => setForm((prev) => ({ ...prev, name: value }))} />
              <div className="space-y-1">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-300">MRN</Label>
                <Input value={patient.mrn} readOnly className="text-sm bg-slate-50 dark:bg-slate-800" />
              </div>
              <Field
                label="Date of Birth"
                value={form.dob}
                onChange={(value) => setForm((prev) => ({ ...prev, dob: value }))}
                type="date"
              />
              <div className="space-y-1">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-300">Gender</Label>
                <select
                  value={form.gender}
                  onChange={(event) => setForm((prev) => ({ ...prev, gender: event.target.value }))}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Not specified</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                  <option value="Unknown">Unknown</option>
                </select>
              </div>
            </div>
            <Badge className="border border-slate-200 bg-slate-50 text-[9px] font-black uppercase tracking-wide text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
              {patient.codeStatus || "Full Code"}
            </Badge>
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-300">
              Contact Details
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => copySection("Contact details", contactText)} className="h-7 gap-1 text-[9px] font-black uppercase text-blue-600">
              <Copy className="h-3.5 w-3.5" /> Copy
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <Field
              label="Phone Number"
              value={form.phoneNumber}
              onChange={(value) => setForm((prev) => ({ ...prev, phoneNumber: formatPhoneInput(value) }))}
              inputMode="tel"
              placeholder="(555) 123-4567"
              error={validationErrors.phoneNumber}
            />
            <Field
              label="Email Address"
              value={form.emailAddress}
              onChange={(value) => setForm((prev) => ({ ...prev, emailAddress: value }))}
              type="email"
              placeholder="name@example.com"
              error={validationErrors.emailAddress}
            />
            <Field label="Preferred Language" value={form.preferredLanguage} onChange={(value) => setForm((prev) => ({ ...prev, preferredLanguage: value }))} />
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-300">
              Address
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => copySection("Address", formatAddress(form))} className="h-7 gap-1 text-[9px] font-black uppercase text-blue-600">
              <Copy className="h-3.5 w-3.5" /> Copy
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <Field label="Address Line 1" value={form.addressLine1} onChange={(value) => setForm((prev) => ({ ...prev, addressLine1: value }))} />
            <Field label="Address Line 2" value={form.addressLine2} onChange={(value) => setForm((prev) => ({ ...prev, addressLine2: value }))} />
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <Field label="City" value={form.city} onChange={(value) => setForm((prev) => ({ ...prev, city: value }))} />
              <Field
                label="State"
                value={form.state}
                onChange={(value) => setForm((prev) => ({ ...prev, state: normalizeStateInput(value) }))}
                maxLength={2}
                placeholder="WA"
                error={validationErrors.state}
              />
              <Field
                label="Postal Code"
                value={form.postalCode}
                onChange={(value) => setForm((prev) => ({ ...prev, postalCode: formatPostalInput(value) }))}
                inputMode="numeric"
                placeholder="98101"
                error={validationErrors.postalCode}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-300">
              Emergency Contact
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => copySection("Emergency contact", emergencyText)} className="h-7 gap-1 text-[9px] font-black uppercase text-blue-600">
              <Copy className="h-3.5 w-3.5" /> Copy
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <Field label="Contact Name" value={form.emergencyContactName} onChange={(value) => setForm((prev) => ({ ...prev, emergencyContactName: value }))} />
            <Field
              label="Contact Phone"
              value={form.emergencyContactPhone}
              onChange={(value) => setForm((prev) => ({ ...prev, emergencyContactPhone: formatPhoneInput(value) }))}
              inputMode="tel"
              placeholder="(555) 123-4567"
              error={validationErrors.emergencyContactPhone}
            />
            <Field label="Relationship" value={form.emergencyContactRelation} onChange={(value) => setForm((prev) => ({ ...prev, emergencyContactRelation: value }))} />
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-300">
              Social Determinants
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => copySection("Social determinants", socialText)} className="h-7 gap-1 text-[9px] font-black uppercase text-blue-600">
              <Copy className="h-3.5 w-3.5" /> Copy
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <Field
              label="Living Situation"
              value={form.livingSituation}
              onChange={(value) => setForm((prev) => ({ ...prev, livingSituation: value }))}
              placeholder="Lives with family"
            />
            <Field
              label="Smoking Status"
              value={form.smokingStatus}
              onChange={(value) => setForm((prev) => ({ ...prev, smokingStatus: value }))}
              placeholder="Never / Former / Current"
            />
            <Field
              label="Alcohol Use"
              value={form.alcoholUse}
              onChange={(value) => setForm((prev) => ({ ...prev, alcoholUse: value }))}
              placeholder="None / Social / Daily"
            />
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-300">
            Clinical Snapshot
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => copySection("Clinical snapshot", clinicalText)} className="h-7 gap-1 text-[9px] font-black uppercase text-blue-600">
            <Copy className="h-3.5 w-3.5" /> Copy
          </Button>
        </CardHeader>
        <CardContent>
          <Field
            label="Allergies (comma-separated)"
            value={form.allergiesText}
            onChange={(value) => setForm((prev) => ({ ...prev, allergiesText: value }))}
            placeholder="Penicillin, Latex"
          />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Current Allergies: {parsedAllergies.length > 0 ? parsedAllergies.join(", ") : "No known allergies"}
          </p>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {hasUnsavedChanges ? (
          <Badge className="border-amber-300 bg-amber-50 text-[9px] font-black uppercase tracking-widest text-amber-700 dark:border-amber-600/40 dark:bg-amber-500/10 dark:text-amber-300">
            Unsaved Changes
          </Badge>
        ) : (
          <Badge className="border-emerald-300 bg-emerald-50 text-[9px] font-black uppercase tracking-widest text-emerald-700 dark:border-emerald-600/40 dark:bg-emerald-500/10 dark:text-emerald-300">
            Saved
          </Badge>
        )}

        <div className="flex items-center gap-2">
          <Button
            onClick={revertChanges}
            variant="outline"
            disabled={saving || !hasUnsavedChanges}
            className="gap-2"
          >
            <RotateCcw className="h-4 w-4" /> Cancel Changes
          </Button>
          <Button onClick={saveInfo} disabled={saving || hasValidationErrors || !hasUnsavedChanges} className="gap-2 bg-blue-600 hover:bg-blue-700">
          <Save className="h-4 w-4" /> {saving ? "Saving" : "Save Info"}
        </Button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type,
  placeholder,
  inputMode,
  maxLength,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "email" | "date";
  placeholder?: string;
  inputMode?: "text" | "email" | "numeric" | "decimal" | "tel" | "search" | "url";
  maxLength?: number;
  error?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-300">{label}</Label>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        placeholder={placeholder}
        inputMode={inputMode}
        maxLength={maxLength}
        aria-invalid={Boolean(error)}
        className={`text-sm ${error ? "border-rose-300 focus-visible:ring-rose-400 dark:border-rose-500/60" : ""}`}
      />
      {error && <p className="text-[10px] font-semibold text-rose-600 dark:text-rose-400">{error}</p>}
    </div>
  );
}
