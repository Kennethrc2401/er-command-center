"use client";

import { useMemo, useState } from "react";
import { BookOpen, FlaskConical, HeartPulse, Pill, Search, X } from "lucide-react";
import { useResolvedActor } from "@/lib/hooks/useResolvedActor";
import { CLINICAL_REF } from "@/lib/constants/references";

type ReferenceTab = "drugs" | "clinical";
type ClinicalGroup = "labs" | "vitals" | "procedures";
type LabOrVitalEntry = (typeof CLINICAL_REF.LABS)[number];
type ProcedureEntry = (typeof CLINICAL_REF.PROCEDURE_PREP_GUIDES)[number];

export default function ReferencesPage() {
  const { actorRole } = useResolvedActor();
  const [tab, setTab] = useState<ReferenceTab>("drugs");
  const [group, setGroup] = useState<ClinicalGroup>("labs");
  const [query, setQuery] = useState("");
  const [selectedProcedure, setSelectedProcedure] = useState<ProcedureEntry | null>(null);

  const normalizedQuery = query.trim().toLowerCase();

  // Role-based procedure filtering logic
  const isObGynRole = actorRole === "RN" || actorRole === "CNM" || actorRole === "CCMA" || actorRole === "DOCTOR";
  const isClinicalRole = actorRole && actorRole !== "ADMIN";

  const visibleDrugs = useMemo(() => {
    const allDrugs = CLINICAL_REF.DRUG_DICTIONARY;
    if (!normalizedQuery) return allDrugs;

    return allDrugs.filter((drug) => {
      const haystack = [
        drug.name,
        drug.class,
        drug.indications,
        drug.adultDose,
        drug.monitoring,
        drug.cautions,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [normalizedQuery]);

  const visibleLabOrVital = useMemo<LabOrVitalEntry[]>(() => {
    if (group === "labs") {
      return CLINICAL_REF.LABS.filter((item) => {
        if (!normalizedQuery) return true;
        const haystack = [item.name, item.range, item.critical, item.note].join(" ").toLowerCase();
        return haystack.includes(normalizedQuery);
      });
    }

    if (group === "vitals") {
      return CLINICAL_REF.VITALS.filter((item) => {
        if (!normalizedQuery) return true;
        const haystack = [item.name, item.range, item.critical, item.note].join(" ").toLowerCase();
        return haystack.includes(normalizedQuery);
      });
    }

    return [];
  }, [group, normalizedQuery]);

  const visibleProcedures = useMemo<ProcedureEntry[]>(() => {
    if (group !== "procedures") return [];

    const procedures = CLINICAL_REF.PROCEDURE_PREP_GUIDES.filter((item) => {
      if (!normalizedQuery) return true;
      const haystack = [
        item.name,
        item.unit,
        item.setupGoal,
        item.scopeNote,
        ...item.supplies,
        ...item.prepSteps,
        ...item.setupChecklist,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });

    // Role-based filtering: OB/GYN procedures for clinical roles
    if (isObGynRole && isClinicalRole) {
      // All obstetrics and gynecology procedures visible
      return procedures;
    }

    // Show all procedures by default, but in production you'd filter based on role relevance
    return procedures;
  }, [group, normalizedQuery, isObGynRole, isClinicalRole]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.09),transparent_35%),linear-gradient(to_bottom,rgba(248,250,252,0.98),rgba(241,245,249,0.92))] px-4 pb-10 pt-24 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className="aurora-panel glass-panel rounded-[2rem] p-6 sm:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">
                Clinical Knowledge Workspace
              </p>
              <h1 className="text-3xl font-black uppercase italic tracking-tight text-slate-900 dark:text-slate-100 sm:text-4xl lg:text-5xl">
                References Hub
              </h1>
              <p className="max-w-3xl text-sm leading-7 text-slate-600 dark:text-slate-300">
                Dedicated bedside references with a searchable drug dictionary and clinical quick-reference library for labs,
                vitals, and procedure setup workflows.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setTab("drugs")}
                className={`rounded-2xl px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] transition-all ${
                  tab === "drugs"
                    ? "bg-cyan-600 text-white shadow-lg shadow-cyan-300/30"
                    : "border border-slate-200 bg-white text-slate-600 hover:border-cyan-300 hover:text-cyan-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                }`}
              >
                Drug Dictionary
              </button>
              <button
                type="button"
                onClick={() => setTab("clinical")}
                className={`rounded-2xl px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] transition-all ${
                  tab === "clinical"
                    ? "bg-violet-600 text-white shadow-lg shadow-violet-300/30"
                    : "border border-slate-200 bg-white text-slate-600 hover:border-violet-300 hover:text-violet-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                }`}
              >
                Clinical Reference
              </button>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search medications, labs, vitals, or procedure setup steps..."
              className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100"
            />
          </div>
        </section>

        {tab === "drugs" ? (
          <section className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {visibleDrugs.map((drug) => (
                <article
                  key={drug.name}
                  className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 dark:text-slate-500">Medication</p>
                      <h2 className="mt-1 text-base font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">{drug.name}</h2>
                    </div>
                    <div className="rounded-xl bg-cyan-50 p-2 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300">
                      <Pill className="h-4 w-4" />
                    </div>
                  </div>

                  <dl className="space-y-2 text-xs leading-6 text-slate-600 dark:text-slate-300">
                    <div>
                      <dt className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Class</dt>
                      <dd>{drug.class}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Indications</dt>
                      <dd>{drug.indications}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Adult Dose</dt>
                      <dd>{drug.adultDose}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Monitoring</dt>
                      <dd>{drug.monitoring}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Cautions</dt>
                      <dd>{drug.cautions}</dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>

            {visibleDrugs.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                No medication entries matched your search.
              </p>
            ) : null}
          </section>
        ) : (
          <section className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setGroup("labs")}
                className={`rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] ${
                  group === "labs"
                    ? "bg-blue-600 text-white"
                    : "border border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                }`}
              >
                <span className="inline-flex items-center gap-1">
                  <FlaskConical className="h-3.5 w-3.5" /> Labs
                </span>
              </button>
              <button
                type="button"
                onClick={() => setGroup("vitals")}
                className={`rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] ${
                  group === "vitals"
                    ? "bg-emerald-600 text-white"
                    : "border border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                }`}
              >
                <span className="inline-flex items-center gap-1">
                  <HeartPulse className="h-3.5 w-3.5" /> Vitals
                </span>
              </button>
              <button
                type="button"
                onClick={() => setGroup("procedures")}
                className={`rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] ${
                  group === "procedures"
                    ? "bg-violet-600 text-white"
                    : "border border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                }`}
              >
                <span className="inline-flex items-center gap-1">
                  <BookOpen className="h-3.5 w-3.5" /> Procedures
                </span>
              </button>
            </div>

            {group !== "procedures" ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {visibleLabOrVital.map((entry) => (
                  <article
                    key={entry.name}
                    className="rounded-4xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                  >
                    <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">{entry.name}</h3>
                    <p className="mt-2 text-xs text-slate-600 dark:text-slate-300"><span className="font-black">Range:</span> {entry.range}</p>
                    <p className="mt-1 text-xs text-rose-600 dark:text-rose-300"><span className="font-black">Critical:</span> {entry.critical}</p>
                    <p className="mt-2 text-xs leading-6 text-slate-500 dark:text-slate-400">{entry.note}</p>
                  </article>
                ))}
              </div>
            ) : (
              <div className="grid gap-4 xl:grid-cols-2">
                {visibleProcedures.map((entry) => (
                  <button
                    key={`${entry.unit}-${entry.name}`}
                    onClick={() => setSelectedProcedure(entry)}
                    className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg hover:border-violet-300 dark:border-slate-800 dark:bg-slate-900 text-left"
                  >
                    <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 dark:text-slate-500">{entry.unit}</p>
                    <h3 className="mt-1 text-base font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">{entry.name}</h3>
                    <p className="mt-2 text-xs leading-6 text-slate-600 dark:text-slate-300">{entry.setupGoal}</p>
                    <p className="mt-2 text-xs leading-6 text-slate-500 dark:text-slate-400"><span className="font-black">Scope:</span> {entry.scopeNote}</p>

                    <div className="mt-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Setup Checklist</p>
                      <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-slate-600 dark:text-slate-300">
                        {entry.setupChecklist.slice(0, 5).map((check) => (
                          <li key={check}>{check}</li>
                        ))}
                      </ul>
                    </div>
                    
                    <p className="mt-3 text-[9px] font-black uppercase tracking-[0.2em] text-violet-600 dark:text-violet-400">Click for full details →</p>
                  </button>
                ))}
              </div>
            )}

            {group !== "procedures" && visibleLabOrVital.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                No clinical reference entries matched your search.
              </p>
            ) : null}

            {group === "procedures" && visibleProcedures.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                No clinical reference entries matched your search.
              </p>
            ) : null}
          </section>
        )}
      </div>

      {selectedProcedure ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 py-6 backdrop-blur-md">
          <div className="aurora-panel glass-panel max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-[2rem] border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950">
            <div className="sticky top-0 flex items-center justify-between gap-4 border-b border-slate-200/80 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-950">
              <div className="flex-1">
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 dark:text-slate-500">
                  {selectedProcedure.unit}
                </p>
                <h2 className="mt-1 text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">
                  {selectedProcedure.name}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProcedure(null)}
                className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-6 p-6">
              <div>
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-900 dark:text-slate-100">
                  Setup Goal
                </h3>
                <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">
                  {selectedProcedure.setupGoal}
                </p>
              </div>

              <div>
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-900 dark:text-slate-100">
                  Scope Note
                </h3>
                <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">
                  {selectedProcedure.scopeNote}
                </p>
              </div>

              <div>
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-900 dark:text-slate-100">
                  Supplies ({selectedProcedure.supplies.length})
                </h3>
                <ul className="mt-3 list-disc space-y-1 pl-6 text-sm text-slate-600 dark:text-slate-300">
                  {selectedProcedure.supplies.map((supply) => (
                    <li key={supply}>{supply}</li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-900 dark:text-slate-100">
                  Preparation Steps ({selectedProcedure.prepSteps.length})
                </h3>
                <ol className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                  {selectedProcedure.prepSteps.map((step, index) => (
                    <li key={step} className="flex gap-3">
                      <span className="shrink-0 font-black text-violet-600 dark:text-violet-400">{index + 1}.</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <div>
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-900 dark:text-slate-100">
                  Setup Checklist ({selectedProcedure.setupChecklist.length})
                </h3>
                <ul className="mt-3 space-y-2">
                  {selectedProcedure.setupChecklist.map((check) => (
                    <li key={check} className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-300">
                      <input
                        type="checkbox"
                        disabled
                        defaultChecked={false}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 dark:border-slate-600"
                      />
                      <span>{check}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
