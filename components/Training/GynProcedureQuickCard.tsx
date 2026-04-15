"use client";

import { useMemo, useState } from "react";
import { ClipboardList, Printer, CheckSquare, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CLINICAL_REF } from "@/lib/constants/references";
import { toast } from "sonner";

type Procedure = (typeof CLINICAL_REF.PROCEDURE_PREP_GUIDES)[number];
type PrepRole = "CCMA" | "RN" | "Provider" | "All";

const DEFAULT_PROCEDURE_KEY = "training:prep-default-procedure";
const FAVORITE_PROCEDURES_KEY = "training:prep-favorite-procedures";

function readDefaultProcedure() {
  if (typeof window === "undefined") return CLINICAL_REF.PROCEDURE_PREP_GUIDES[0]?.name ?? "";
  return window.localStorage.getItem(DEFAULT_PROCEDURE_KEY) ?? CLINICAL_REF.PROCEDURE_PREP_GUIDES[0]?.name ?? "";
}

function readFavoriteProcedures() {
  if (typeof window === "undefined") return [] as string[];
  const raw = window.localStorage.getItem(FAVORITE_PROCEDURES_KEY);
  if (!raw) return [] as string[];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [] as string[];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [] as string[];
  }
}

function getUnitForProcedure(procedureName: string) {
  const match = CLINICAL_REF.PROCEDURE_PREP_GUIDES.find((procedure) => procedure.name === procedureName);
  return match?.unit ?? "All";
}

export default function GynProcedureQuickCard() {
  const [selectedName, setSelectedName] = useState(readDefaultProcedure);
  const [selectedUnit, setSelectedUnit] = useState<string>(() => getUnitForProcedure(readDefaultProcedure()));
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [activeRole, setActiveRole] = useState<PrepRole>("CCMA");
  const [favoriteNames, setFavoriteNames] = useState<string[]>(readFavoriteProcedures);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  const unitOptions = useMemo(() => {
    const units = Array.from(new Set(CLINICAL_REF.PROCEDURE_PREP_GUIDES.map((procedure) => procedure.unit)));
    return ["All", ...units];
  }, []);

  const visibleProcedures = useMemo(() => {
    const unitFiltered = selectedUnit === "All"
      ? CLINICAL_REF.PROCEDURE_PREP_GUIDES
      : CLINICAL_REF.PROCEDURE_PREP_GUIDES.filter((procedure) => procedure.unit === selectedUnit);

    if (!showFavoritesOnly) return unitFiltered;
    return unitFiltered.filter((procedure) => favoriteNames.includes(procedure.name));
  }, [favoriteNames, selectedUnit, showFavoritesOnly]);

  const selectedProcedure: Procedure | undefined = useMemo(
    () => visibleProcedures.find((procedure) => procedure.name === selectedName) ?? visibleProcedures[0],
    [selectedName, visibleProcedures]
  );

  const checklistItems = selectedProcedure?.setupChecklist ?? [];
  const isFavorite = selectedProcedure ? favoriteNames.includes(selectedProcedure.name) : false;

  const roleFocus = useMemo(() => {
    if (!selectedProcedure) return [] as string[];

    if (activeRole === "CCMA") {
      return [
        "Prioritize room setup, supply staging, labels, and patient comfort/chaperone readiness.",
        "Escalate missing supplies or unexpected patient status changes early.",
        "Confirm transport/specimen handoff workflow before procedure starts.",
      ];
    }

    if (activeRole === "RN") {
      return [
        "Coordinate readiness checks, patient safety workflow, and post-procedure monitoring handoff.",
        "Confirm medication/support supplies are available per protocol.",
        "Reinforce return precautions and follow-up timing with patient/family.",
      ];
    }

    if (activeRole === "Provider") {
      return [
        "Validate indication, consent, and procedural timeout requirements.",
        "Confirm diagnostic/therapeutic plan and specimen priorities with team.",
        "Direct escalation for non-routine findings or instability.",
      ];
    }

    return [
      "Use this card to align setup, safety checks, and communication before procedure start.",
    ];
  }, [activeRole, selectedProcedure]);

  const toggleChecked = (item: string) => {
    setCheckedItems((current) => ({ ...current, [item]: !current[item] }));
  };

  const toggleFavorite = () => {
    if (!selectedProcedure) return;

    setFavoriteNames((current) => {
      const next = current.includes(selectedProcedure.name)
        ? current.filter((item) => item !== selectedProcedure.name)
        : [...current, selectedProcedure.name];

      if (typeof window !== "undefined") {
        window.localStorage.setItem(FAVORITE_PROCEDURES_KEY, JSON.stringify(next));
      }

      return next;
    });
  };

  const setAsDefaultProcedure = () => {
    if (!selectedProcedure || typeof window === "undefined") return;
    window.localStorage.setItem(DEFAULT_PROCEDURE_KEY, selectedProcedure.name);
    toast.success("Default procedure saved.");
  };

  const copyChecklist = async () => {
    if (!selectedProcedure) return;

    const lines = [
      `${selectedProcedure.name} - Setup Card`,
      `Goal: ${selectedProcedure.setupGoal}`,
      "",
      "Supplies:",
      ...selectedProcedure.supplies.map((item) => `- ${item}`),
      "",
      "Prep Steps:",
      ...selectedProcedure.prepSteps.map((item, index) => `${index + 1}. ${item}`),
      "",
      "Room-Ready Checklist:",
      ...selectedProcedure.setupChecklist.map((item) => `- [ ] ${item}`),
      "",
      `Scope Note: ${selectedProcedure.scopeNote}`,
      "Training reference only. Follow facility policy and provider instructions.",
    ];

    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      toast.success("Procedure setup card copied.");
    } catch {
      toast.error("Unable to copy setup card.");
    }
  };

  const printChecklist = () => {
    if (!selectedProcedure) return;

    const printable = window.open("", "_blank", "width=900,height=700");
    if (!printable) {
      toast.error("Popup blocked. Allow popups to print this card.");
      return;
    }

    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${selectedProcedure.name} Setup Card</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 24px; line-height: 1.4; color: #111827; }
      h1 { margin: 0 0 8px; font-size: 20px; }
      h2 { margin: 16px 0 8px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.06em; color: #374151; }
      p { margin: 0 0 8px; }
      ul { margin: 0; padding-left: 18px; }
      li { margin-bottom: 6px; }
      .note { margin-top: 16px; font-size: 12px; color: #4b5563; border-top: 1px solid #e5e7eb; padding-top: 10px; }
    </style>
  </head>
  <body>
    <h1>${selectedProcedure.name} Setup Card</h1>
    <p><strong>Goal:</strong> ${selectedProcedure.setupGoal}</p>

    <h2>Supplies</h2>
    <ul>
      ${selectedProcedure.supplies.map((item) => `<li>${item}</li>`).join("")}
    </ul>

    <h2>Prep Steps</h2>
    <ul>
      ${selectedProcedure.prepSteps.map((item) => `<li>${item}</li>`).join("")}
    </ul>

    <h2>Room-Ready Checklist</h2>
    <ul>
      ${selectedProcedure.setupChecklist.map((item) => `<li>[ ] ${item}</li>`).join("")}
    </ul>

    <p class="note"><strong>Scope Note:</strong> ${selectedProcedure.scopeNote}<br/>Training reference only. Follow facility policy and provider instructions.</p>
    <script>window.print();</script>
  </body>
</html>`;

    printable.document.open();
    printable.document.write(html);
    printable.document.close();
  };

  if (!selectedProcedure) {
    return (
      <section className="glass-panel aurora-panel rounded-[2rem] border border-violet-200 bg-white p-5 shadow-lg shadow-violet-100/60 dark:border-violet-500/30 dark:bg-slate-900 dark:shadow-slate-950/30 sm:p-6">
        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-violet-500">Procedure Prep</p>
        <h3 className="mt-1 text-lg font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">
          Clinic/Hospital/L&D Quick Card
        </h3>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
          No procedures match the current filter. Turn off Favorites only or switch Setting.
        </p>
        <Button type="button" className="mt-3" variant="outline" onClick={() => setShowFavoritesOnly(false)}>
          Show All Procedures
        </Button>
      </section>
    );
  }

  return (
    <section className="glass-panel aurora-panel rounded-[2rem] border border-violet-200 bg-white p-5 shadow-lg shadow-violet-100/60 dark:border-violet-500/30 dark:bg-slate-900 dark:shadow-slate-950/30 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <span className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-[9px] font-black uppercase tracking-[0.25em] text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-200">
            Procedure Prep
          </span>
          <div>
            <h3 className="text-lg font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">
              Clinic/Hospital/L&D Quick Card
            </h3>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              Faster room setup, better handoffs, cleaner checklist flow.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={toggleFavorite} className="gap-1">
            <Star className={`h-3.5 w-3.5 ${isFavorite ? "fill-amber-400 text-amber-500" : ""}`} />
            {isFavorite ? "Favorited" : "Favorite"}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={setAsDefaultProcedure}>
            Set Default
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={copyChecklist} className="gap-1">
            <ClipboardList className="h-3.5 w-3.5" /> Copy
          </Button>
          <Button type="button" size="sm" onClick={printChecklist} className="gap-1 bg-violet-600 hover:bg-violet-500">
            <Printer className="h-3.5 w-3.5" /> Print Card
          </Button>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white/70 p-3 dark:border-slate-700 dark:bg-slate-950/40">
        <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
          <input
            type="checkbox"
            checked={showFavoritesOnly}
            onChange={(event) => {
              setShowFavoritesOnly(event.target.checked);
              setCheckedItems({});
            }}
            className="h-4 w-4"
          />
          Favorites only
        </div>
        <label className="mb-1 block text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
          Setting
        </label>
        <select
          className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
          value={selectedUnit}
          onChange={(event) => {
            const nextUnit = event.target.value;
            setSelectedUnit(nextUnit);
            const nextProcedures = nextUnit === "All"
              ? CLINICAL_REF.PROCEDURE_PREP_GUIDES
              : CLINICAL_REF.PROCEDURE_PREP_GUIDES.filter((procedure) => procedure.unit === nextUnit);
            setSelectedName(nextProcedures[0]?.name ?? "");
            setCheckedItems({});
          }}
        >
          {unitOptions.map((unit) => (
            <option key={unit} value={unit}>{unit}</option>
          ))}
        </select>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white/70 p-3 dark:border-slate-700 dark:bg-slate-950/40">
        <label className="mb-1 block text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
          Procedure
        </label>
        <select
          className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
          value={selectedName}
          onChange={(event) => {
            setSelectedName(event.target.value);
            setCheckedItems({});
          }}
        >
          {visibleProcedures.map((procedure) => (
            <option key={procedure.name} value={procedure.name}>
              {procedure.name}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-200">
          Unit: {selectedProcedure.unit}
        </span>
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-slate-600 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-300">
          Role: {activeRole}
        </span>
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-slate-600 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-300">
          {favoriteNames.length} Saved
        </span>
      </div>

      <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">{selectedProcedure.setupGoal}</p>

      <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50 p-3 shadow-sm dark:border-violet-500/30 dark:bg-violet-900/10">
        <p className="text-[10px] font-black uppercase tracking-widest text-violet-700 dark:text-violet-300">Role Focus</p>
        <div className="mt-2 flex flex-wrap gap-1">
          {(["CCMA", "RN", "Provider", "All"] as PrepRole[]).map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => setActiveRole(role)}
              className={`rounded border px-2 py-1 text-[10px] font-black uppercase tracking-widest ${
                activeRole === role
                  ? "border-violet-500 bg-violet-500 text-white"
                  : "border-violet-200 text-violet-700 hover:bg-violet-100 dark:border-violet-700 dark:text-violet-200 dark:hover:bg-violet-800/30"
              }`}
            >
              {role}
            </button>
          ))}
        </div>
        <ul className="mt-2 space-y-1 text-sm text-violet-900 dark:text-violet-200">
          {roleFocus.map((item) => (
            <li key={item}>- {item}</li>
          ))}
        </ul>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 shadow-sm dark:border-slate-700 dark:bg-slate-950/50">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Supplies</p>
          <ul className="mt-2 space-y-1 text-sm text-slate-700 dark:text-slate-200">
            {selectedProcedure.supplies.map((item) => (
              <li key={item}>- {item}</li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 shadow-sm dark:border-slate-700 dark:bg-slate-950/50">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Prep Steps</p>
          <ol className="mt-2 space-y-1 text-sm text-slate-700 dark:text-slate-200">
            {selectedProcedure.prepSteps.map((item, index) => (
              <li key={item}>{index + 1}. {item}</li>
            ))}
          </ol>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 shadow-sm dark:border-emerald-500/30 dark:bg-emerald-900/10">
        <p className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-300">
          <CheckSquare className="h-3.5 w-3.5" /> Room-Ready Checklist
        </p>
        <div className="mt-2 max-h-44 overflow-y-auto space-y-1">
          {checklistItems.map((item) => (
            <label key={item} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={Boolean(checkedItems[item])}
                onChange={() => toggleChecked(item)}
                className="mt-0.5 h-4 w-4"
              />
              <span>{item}</span>
            </label>
          ))}
        </div>
      </div>

      <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">
        {selectedProcedure.scopeNote} Training reference only; follow your facility policy and provider instructions.
      </p>
    </section>
  );
}
