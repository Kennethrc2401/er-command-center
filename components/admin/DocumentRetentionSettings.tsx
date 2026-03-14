"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { useResolvedActor } from "@/lib/hooks/useResolvedActor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, RotateCcw, Save, Settings2 } from "lucide-react";

type DocumentCategory =
  | "LAB_RESULT"
  | "EXTERNAL_RESULT"
  | "RADIOLOGY_IMAGE"
  | "LETTER"
  | "BILLING"
  | "MISC";

type CategoryStringMap = Record<DocumentCategory, string>;
type CategoryNumberMap = Record<DocumentCategory, number>;

const CATEGORY_ROWS: Array<{ key: DocumentCategory; label: string }> = [
  { key: "LAB_RESULT", label: "Lab Result" },
  { key: "EXTERNAL_RESULT", label: "External Result" },
  { key: "RADIOLOGY_IMAGE", label: "Radiology Image" },
  { key: "LETTER", label: "Letter" },
  { key: "BILLING", label: "Billing" },
  { key: "MISC", label: "Misc" },
];

const DEFAULT_RETENTION_DAYS: CategoryNumberMap = {
  LAB_RESULT: 3650,
  EXTERNAL_RESULT: 3650,
  RADIOLOGY_IMAGE: 3650,
  LETTER: 1825,
  BILLING: 2555,
  MISC: 180,
};

const DEFAULT_PURGE_GRACE_DAYS: CategoryNumberMap = {
  LAB_RESULT: 0,
  EXTERNAL_RESULT: 0,
  RADIOLOGY_IMAGE: 0,
  LETTER: 0,
  BILLING: 0,
  MISC: 30,
};

const buildStringMap = (source: CategoryNumberMap): CategoryStringMap => ({
  LAB_RESULT: String(source.LAB_RESULT),
  EXTERNAL_RESULT: String(source.EXTERNAL_RESULT),
  RADIOLOGY_IMAGE: String(source.RADIOLOGY_IMAGE),
  LETTER: String(source.LETTER),
  BILLING: String(source.BILLING),
  MISC: String(source.MISC),
});

const normalizeNumericCategoryMap = (
  value: unknown,
  fallback: CategoryNumberMap,
  legacyMiscValue?: unknown
): CategoryNumberMap => {
  const record = value && typeof value === "object" ? (value as Partial<Record<DocumentCategory, unknown>>) : undefined;

  const parseOrFallback = (key: DocumentCategory) => {
    const candidate = record?.[key];
    if (typeof candidate === "number" && Number.isFinite(candidate)) return candidate;
    return fallback[key];
  };

  const miscOverride =
    typeof legacyMiscValue === "number" && Number.isFinite(legacyMiscValue)
      ? legacyMiscValue
      : parseOrFallback("MISC");

  return {
    LAB_RESULT: parseOrFallback("LAB_RESULT"),
    EXTERNAL_RESULT: parseOrFallback("EXTERNAL_RESULT"),
    RADIOLOGY_IMAGE: parseOrFallback("RADIOLOGY_IMAGE"),
    LETTER: parseOrFallback("LETTER"),
    BILLING: parseOrFallback("BILLING"),
    MISC: miscOverride,
  };
};

const normalizeStringCategoryMap = (value: unknown, fallback: CategoryStringMap): CategoryStringMap => {
  const record = value && typeof value === "object" ? (value as Partial<Record<DocumentCategory, unknown>>) : undefined;

  const pick = (key: DocumentCategory) => {
    const candidate = record?.[key];
    if (typeof candidate === "string") return candidate;
    return fallback[key];
  };

  return {
    LAB_RESULT: pick("LAB_RESULT"),
    EXTERNAL_RESULT: pick("EXTERNAL_RESULT"),
    RADIOLOGY_IMAGE: pick("RADIOLOGY_IMAGE"),
    LETTER: pick("LETTER"),
    BILLING: pick("BILLING"),
    MISC: pick("MISC"),
  };
};

type EditableSettings = {
  retentionDaysByCategory: CategoryStringMap;
  purgeGraceDaysByCategory: CategoryStringMap;
  sweepIntervalHours: string;
};

const DEFAULT_FORM: EditableSettings = {
  retentionDaysByCategory: buildStringMap(DEFAULT_RETENTION_DAYS),
  purgeGraceDaysByCategory: buildStringMap(DEFAULT_PURGE_GRACE_DAYS),
  sweepIntervalHours: "6",
};

const MIN_RETENTION_DAYS = 1;
const MAX_RETENTION_DAYS = 36500;
const MIN_PURGE_GRACE_DAYS = 0;
const MAX_PURGE_GRACE_DAYS = 36500;
const DEFAULT_SWEEP_INTERVAL_HOURS = 6;
const MIN_SWEEP_INTERVAL_HOURS = 1;
const MAX_SWEEP_INTERVAL_HOURS = 24;

const formatTimestamp = (timestamp?: number) => {
  if (!timestamp) return "Not recorded yet";
  return new Date(timestamp).toLocaleString();
};

const parseCategoryMap = (values: CategoryStringMap) => {
  const parsed = {} as CategoryNumberMap;

  for (const { key } of CATEGORY_ROWS) {
    const numeric = Number.parseInt(values[key], 10);
    if (Number.isNaN(numeric)) {
      throw new Error(`Invalid numeric value for ${key}`);
    }
    parsed[key] = numeric;
  }

  return parsed;
};

export default function DocumentRetentionSettings() {
  const { actorName, actorRole, isAdmin } = useResolvedActor();
  const settings = useQuery(api.chartDocuments.getRetentionSettings);
  const updateSettings = useMutation(api.chartDocuments.updateRetentionSettings);

  const [form, setForm] = useState<EditableSettings>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [defaultsPendingSave, setDefaultsPendingSave] = useState(false);

  useEffect(() => {
    if (!settings) return;

    const normalizedRetention = normalizeNumericCategoryMap(
      (settings as { retentionDaysByCategory?: unknown }).retentionDaysByCategory,
      DEFAULT_RETENTION_DAYS,
      (settings as { miscRetentionDays?: unknown }).miscRetentionDays
    );
    const normalizedPurgeGrace = normalizeNumericCategoryMap(
      (settings as { purgeGraceDaysByCategory?: unknown }).purgeGraceDaysByCategory,
      DEFAULT_PURGE_GRACE_DAYS,
      (settings as { miscArchivePurgeGraceDays?: unknown }).miscArchivePurgeGraceDays
    );

    setForm({
      retentionDaysByCategory: buildStringMap(normalizedRetention),
      purgeGraceDaysByCategory: buildStringMap(normalizedPurgeGrace),
      sweepIntervalHours: String(settings.sweepIntervalHours),
    });
  }, [settings]);

  const safeRetentionDaysByCategory = useMemo(
    () => normalizeStringCategoryMap((form as { retentionDaysByCategory?: unknown }).retentionDaysByCategory, DEFAULT_FORM.retentionDaysByCategory),
    [form]
  );
  const safePurgeGraceDaysByCategory = useMemo(
    () => normalizeStringCategoryMap((form as { purgeGraceDaysByCategory?: unknown }).purgeGraceDaysByCategory, DEFAULT_FORM.purgeGraceDaysByCategory),
    [form]
  );

  const policyPreview = useMemo(() => {
    const miscRetention = Number(safeRetentionDaysByCategory.MISC);
    const miscGrace = Number(safePurgeGraceDaysByCategory.MISC);
    if (!Number.isFinite(miscRetention) || !Number.isFinite(miscGrace)) {
      return "Enter valid numeric values.";
    }

    const enabledPurges = CATEGORY_ROWS.filter((row) => Number(safePurgeGraceDaysByCategory[row.key]) > 0).length;
    return `MISC archives after ${miscRetention} days and purges ${miscGrace} days later. Hard-delete is enabled for ${enabledPurges} categories.`;
  }, [safeRetentionDaysByCategory, safePurgeGraceDaysByCategory]);

  const formMatchesDefaults = useMemo(() => {
    const retentionMatches = CATEGORY_ROWS.every(
      ({ key }) => safeRetentionDaysByCategory[key] === DEFAULT_FORM.retentionDaysByCategory[key]
    );
    const purgeMatches = CATEGORY_ROWS.every(
      ({ key }) => safePurgeGraceDaysByCategory[key] === DEFAULT_FORM.purgeGraceDaysByCategory[key]
    );
    const sweepMatches = form.sweepIntervalHours === DEFAULT_FORM.sweepIntervalHours;

    return retentionMatches && purgeMatches && sweepMatches;
  }, [safeRetentionDaysByCategory, safePurgeGraceDaysByCategory, form.sweepIntervalHours]);

  useEffect(() => {
    if (defaultsPendingSave && !formMatchesDefaults) {
      setDefaultsPendingSave(false);
    }
  }, [defaultsPendingSave, formMatchesDefaults]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isAdmin) {
      toast.error("Only ADMIN users can change retention settings.");
      return;
    }

    let retentionDaysByCategory: CategoryNumberMap;
    let purgeGraceDaysByCategory: CategoryNumberMap;

    try {
      retentionDaysByCategory = parseCategoryMap(safeRetentionDaysByCategory);
      purgeGraceDaysByCategory = parseCategoryMap(safePurgeGraceDaysByCategory);
    } catch {
      toast.error("All category settings must be valid whole numbers.");
      return;
    }

    for (const { key, label } of CATEGORY_ROWS) {
      if (
        retentionDaysByCategory[key] < MIN_RETENTION_DAYS ||
        retentionDaysByCategory[key] > MAX_RETENTION_DAYS
      ) {
        toast.error(`${label} retention must be between ${MIN_RETENTION_DAYS} and ${MAX_RETENTION_DAYS}.`);
        return;
      }

      if (
        purgeGraceDaysByCategory[key] < MIN_PURGE_GRACE_DAYS ||
        purgeGraceDaysByCategory[key] > MAX_PURGE_GRACE_DAYS
      ) {
        toast.error(`${label} purge grace must be between ${MIN_PURGE_GRACE_DAYS} and ${MAX_PURGE_GRACE_DAYS}.`);
        return;
      }
    }

    const sweepIntervalHours = Number.parseInt(form.sweepIntervalHours, 10);
    if (
      Number.isNaN(sweepIntervalHours) ||
      sweepIntervalHours < MIN_SWEEP_INTERVAL_HOURS ||
      sweepIntervalHours > MAX_SWEEP_INTERVAL_HOURS
    ) {
      toast.error(`Sweep interval must be between ${MIN_SWEEP_INTERVAL_HOURS} and ${MAX_SWEEP_INTERVAL_HOURS} hours.`);
      return;
    }

    setSaving(true);
    try {
      await updateSettings({
        retentionDaysByCategory,
        purgeGraceDaysByCategory,
        sweepIntervalHours,
        actorName,
        actorRole,
      });
      setDefaultsPendingSave(false);
      toast.success("Retention settings updated.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update retention settings.";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const onRestoreDefaults = () => {
    if (!isAdmin) {
      toast.error("Only ADMIN users can change retention settings.");
      return;
    }

    const confirmed = window.confirm(
      "Restore default retention policy values in this form? Click Save Policy to apply them."
    );
    if (!confirmed) return;

    const retentionDaysByCategory = { ...DEFAULT_RETENTION_DAYS };
    const purgeGraceDaysByCategory = { ...DEFAULT_PURGE_GRACE_DAYS };
    const sweepIntervalHours = DEFAULT_SWEEP_INTERVAL_HOURS;

    setForm({
      retentionDaysByCategory: buildStringMap(retentionDaysByCategory),
      purgeGraceDaysByCategory: buildStringMap(purgeGraceDaysByCategory),
      sweepIntervalHours: String(sweepIntervalHours),
    });

    setDefaultsPendingSave(true);
    toast.success("Default values restored in form. Click Save Policy to apply.");
  };

  return (
    <section className="overflow-hidden rounded-[2.5rem] border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/95">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 bg-slate-50/70 p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-2 dark:border-blue-500/30 dark:bg-blue-500/15">
            <Settings2 className="h-4 w-4 text-blue-700 dark:text-blue-300" />
          </div>
          <div>
            <h2 className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">Chart Document Retention Policy</h2>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              Adjust retention and global sweep cadence
            </p>
          </div>
        </div>

        <Badge className="border border-slate-200 bg-white text-[9px] font-black uppercase tracking-widest text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
          {actorRole}
        </Badge>
      </header>

      <form onSubmit={onSubmit} className="space-y-6 p-6">
        <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
          <div className="grid grid-cols-12 gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300">
            <div className="col-span-4">Category</div>
            <div className="col-span-4">Retention Days</div>
            <div className="col-span-4">Purge Grace Days</div>
          </div>
          <div className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900/80">
            {CATEGORY_ROWS.map((row) => (
              <div key={row.key} className="grid grid-cols-12 items-center gap-2 px-4 py-3">
                <div className="col-span-4 text-xs font-black uppercase tracking-wide text-slate-700 dark:text-slate-200">
                  {row.label}
                </div>
                <div className="col-span-4">
                  <Input
                    type="number"
                    min={MIN_RETENTION_DAYS}
                    max={MAX_RETENTION_DAYS}
                    step={1}
                    value={safeRetentionDaysByCategory[row.key]}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        retentionDaysByCategory: {
                          ...normalizeStringCategoryMap((prev as { retentionDaysByCategory?: unknown }).retentionDaysByCategory, DEFAULT_FORM.retentionDaysByCategory),
                          [row.key]: event.target.value,
                        },
                      }))
                    }
                    disabled={saving || !isAdmin}
                  />
                </div>
                <div className="col-span-4">
                  <Input
                    type="number"
                    min={MIN_PURGE_GRACE_DAYS}
                    max={MAX_PURGE_GRACE_DAYS}
                    step={1}
                    value={safePurgeGraceDaysByCategory[row.key]}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        purgeGraceDaysByCategory: {
                          ...normalizeStringCategoryMap((prev as { purgeGraceDaysByCategory?: unknown }).purgeGraceDaysByCategory, DEFAULT_FORM.purgeGraceDaysByCategory),
                          [row.key]: event.target.value,
                        },
                      }))
                    }
                    disabled={saving || !isAdmin}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="sweep-interval" className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-300">
            Global Sweep Interval Hours
          </Label>
          <Input
            id="sweep-interval"
            type="number"
            min={MIN_SWEEP_INTERVAL_HOURS}
            max={MAX_SWEEP_INTERVAL_HOURS}
            step={1}
            value={form.sweepIntervalHours}
            onChange={(event) => setForm((prev) => ({ ...prev, sweepIntervalHours: event.target.value }))}
            disabled={saving || !isAdmin}
          />
          <p className="text-[10px] text-slate-400 dark:text-slate-400">
            Retention range: {MIN_RETENTION_DAYS} to {MAX_RETENTION_DAYS} days. Purge grace range: {MIN_PURGE_GRACE_DAYS} to {MAX_PURGE_GRACE_DAYS} days. Set grace to 0 to disable hard-delete for a category.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/70">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-300">Effective Policy Preview</p>
          <p className="mt-1 text-sm font-semibold text-slate-700 dark:text-slate-100">{policyPreview}</p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-300">
              Last Global Sweep: {formatTimestamp(settings?.lastGlobalSweepAt)}
            </p>
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-300">
              Last config update by {settings?.updatedBy ?? "System defaults"} at {formatTimestamp(settings?.updatedAt)}
            </p>
            {defaultsPendingSave && (
              <Badge className="mt-1 border-amber-300 bg-amber-50 text-[9px] font-black uppercase tracking-widest text-amber-700 dark:border-amber-600/40 dark:bg-amber-500/10 dark:text-amber-300">
                Defaults loaded, not saved
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onRestoreDefaults}
              disabled={saving || !isAdmin}
              className="gap-2 border-slate-300 bg-white hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:hover:bg-slate-800"
            >
              <RotateCcw className="h-4 w-4" /> Restore Defaults
            </Button>

            <Button type="submit" disabled={saving || !isAdmin || settings === undefined} className="gap-2 bg-blue-600 hover:bg-blue-700">
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Saving
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" /> Save Policy
                </>
              )}
            </Button>
          </div>
        </div>

        {!isAdmin && (
          <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">
            Read only mode. Sign in as ADMIN to update these settings.
          </p>
        )}
      </form>
    </section>
  );
}
