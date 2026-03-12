"use client";

import { useEffect, useMemo, useState } from "react";
import { Authenticated, Unauthenticated, AuthLoading, useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Link from "next/link";
import { 
  Clock, 
  Lock, 
  Activity, 
  BedDouble, 
  Trash2, 
  ArrowUpRight,
  Monitor,
  MapPin
} from "lucide-react";
import { SignInButton } from "@clerk/nextjs";
import NewPatientModal from "@/components/NewPatientModal";
import TriageStats from "@/components/TriageStats";

import ShiftSummary from "@/components/ShiftSummary";
import TriageSummaryCard from "@/components/TriageSummaryCard";
import ClinicalAnalytics from "@/components/ClinicalAnalytics";
import SimulateShift from "@/components/Training/SimulateShift";
import ExportReportButton from "@/components/exportReportButton";
import { usePresentationMode } from "@/lib/hooks/usePresentationMode";
import { Input } from "@/components/ui/input";
import { usePrivacyMode } from "@/lib/hooks/usePrivacyMode";
import TriageHandoffModal from "@/components/handoffs/TriageHandoffModal";
import VitalsUpdate from "@/components/clinical/VitalsUpdate";

export default function Page() {
  return (
    <>
      <AuthLoading>
        <div className="flex h-[80vh] items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </AuthLoading>

      <Authenticated>
        <ERDashboardContent />
      </Authenticated>

      <Unauthenticated>
        <div className="flex h-[80vh] flex-col items-center justify-center space-y-6 p-6 text-center">
          <div className="rounded-full bg-slate-100 p-6 text-slate-400 dark:bg-slate-900 dark:text-slate-500">
            <Lock className="h-12 w-12" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-black tracking-tighter text-slate-900 dark:text-slate-100">Clinical Access Restricted</h1>
            <p className="mx-auto max-w-sm font-medium text-slate-500 dark:text-slate-300">
              This system contains Protected Health Information (PHI). Please sign in to access the Command Center.
            </p>
          </div>
          <SignInButton mode="modal">
            <button className="bg-blue-600 text-white px-8 py-3 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-100">
              Staff Login
            </button>
          </SignInButton>
        </div>
      </Unauthenticated>
    </>
  );
}

function ERDashboardContent() {
  const [searchTerm, setSearchTerm] = useState(""); 
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [selectedTriagePatient, setSelectedTriagePatient] = useState<Doc<"encounters"> | null>(null);
  const [vitalsEncounter, setVitalsEncounter] = useState<Doc<"encounters"> | null>(null);
  const { isDemoMode, toggleDemoMode } = usePresentationMode();

  const { isPrivate } = usePrivacyMode();

  const activeEncounters = useQuery(api.encounters.getActive);

  const assignBed = useMutation(api.encounters.assignBed);
  const clearBeds = useMutation(api.encounters.clearAllBeds);
  
  const totalBeds = 20;
  const occupiedBeds = activeEncounters?.filter(e => e.location && e.location.startsWith("Bed")).length ?? 0;
  const availableBeds = totalBeds - occupiedBeds;

  // Sync Timer
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);

  // Critical Alert Logic: Finding the most urgent patient for the Summary Card
  const criticalPatient = useMemo(() => {
    if (!activeEncounters) return undefined;
    return activeEncounters
      .filter(e => e.acuity <= 2 && e.status !== "discharged")
      .sort((a, b) => a.acuity - b.acuity || b._creationTime - a._creationTime)[0];
  }, [activeEncounters]);

  // Audio Alert for ESI-1
  useEffect(() => {
    const hasCritical = activeEncounters?.some(e => e.acuity === 1 && e.status === "waiting");
    if (hasCritical) {
      const audio = new Audio("https://actions.google.com/sounds/v1/alarms/beep_short.ogg");
      audio.volume = 0.05;
      audio.play().catch(() => {});
    }
  }, [activeEncounters]);

  // Global Filter Logic
  const filteredEncounters = activeEncounters?.filter((e) => {
    const matchesSearch = searchTerm === "" || 
      e.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.mrn.toLowerCase().includes(searchTerm.toLowerCase());

    let matchesMetric = true;
    if (activeFilter === "Critical") matchesMetric = e.acuity === 1;
    if (activeFilter === "Bottle-Neck") matchesMetric = e.status === "waiting" && (currentTime - e._creationTime) > 3600000;
    
    return matchesSearch && matchesMetric;
  });

    const formatPatientName = (name: string) => {
      if (!isDemoMode) return name;
      
      const parts = name.trim().split(/\s+/);
      if (parts.length > 1) {
        // Returns "S. Ramirez"
        return `${parts[0][0]}. ${parts[1]}`;
      }
      // Fallback if there's only one name
      return `Patient-${name.length}${name.charCodeAt(0)}`; 
    };

  return (
    <>
    {selectedTriagePatient && (
      <TriageHandoffModal
        encounter={{
          _id: selectedTriagePatient._id,
          patientName: selectedTriagePatient.patientName || "Unknown Patient",
          acuity: selectedTriagePatient.acuity
        }}
        onClose={() => setSelectedTriagePatient(null)}
      />
    )}
    <main className="min-h-screen bg-slate-50/50 p-4 pt-24 text-slate-900 dark:bg-slate-950/30 dark:text-slate-100 md:p-10 md:pt-28">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* 1. HEADER & SEARCH */}
        <div className="flex flex-col items-start justify-between gap-6 border-b border-slate-200/60 pb-6 dark:border-slate-800/80 lg:flex-row lg:items-center">
          {/* Branding & Status */}
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                System Live • {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              
              {/* PRESENTATION MODE TOGGLE */}
              {/* Show toggle button with on or off indicator */}
              <button onClick={toggleDemoMode} className={`ml-4 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest transition-colors ${isDemoMode ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`}>
                {isDemoMode ? "Presentation Mode: ON" : "Presentation Mode: OFF"}
              </button>

              
            </div>
            <h1 className="text-5xl font-black tracking-tighter leading-none italic text-slate-900 dark:text-slate-100">
              ER <span className="text-blue-600">COMMAND</span> CENTER
            </h1>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="border-slate-200 bg-slate-100 px-2 py-0 text-[9px] font-bold uppercase tracking-tighter text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                Hackensack Main
              </Badge>
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                <MapPin className="h-3 w-3" /> Unit 4B • Telemetry Active
              </p>
            </div>
          </div>

          {/* Action Control Strip */}
          <div className="flex flex-wrap items-center gap-3 rounded-[2rem] border border-slate-200/50 bg-white/50 p-2 shadow-sm backdrop-blur-md dark:border-slate-800/70 dark:bg-slate-900/60">
            {/* 1. MONITOR VIEW */}
            <Link href="/dashboard/monitor">
              <button className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-600 shadow-sm transition-all hover:border-slate-900 hover:bg-slate-900 hover:text-white active:scale-95 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800">
                <Monitor className="h-4 w-4 text-blue-500" /> 
                <span className="hidden sm:inline">Monitor View</span>
              </button>
            </Link>

            {/* 2. EXPORT SBAR */}
            <ExportReportButton encounters={filteredEncounters ?? []} />

            <div className="mx-1 hidden h-8 w-px bg-slate-200 dark:bg-slate-700 sm:block" />

            {/* 3. SIMULATE (Training Tool) */}
            <SimulateShift />

            {/* 4. NEW PATIENT (Primary Action) */}
            <NewPatientModal />
          </div>
        </div>

        {isPrivate && (
          <div className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 shadow-sm dark:border-amber-700/40 dark:bg-amber-950/30 dark:text-amber-300">
            <Lock className="h-4 w-4" />
            <span className="text-[10px] font-black uppercase tracking-widest">
              Privacy Mode Active: Patient Identifiers Hidden
            </span>
          </div>
        )}

        {/* NEW ANALYTICS KPI SECTION */}
        <ClinicalAnalytics />

        {/* 2. HIGH ACUITY SUMMARY CARD */}
        {criticalPatient && (
          <TriageSummaryCard criticalPatient={{
            ...criticalPatient,
            vitals: {
              hr: criticalPatient.vitals.hr,
              bp: criticalPatient.vitals.bp,
              spO2: criticalPatient.vitals.spO2
            }
          }} />
        )}

        {/* 3. SHIFT SUMMARY & METRICS */}
        <section className="space-y-6">
          <ShiftSummary onFilterChange={setActiveFilter} activeFilter={activeFilter} />
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Unit Load */}
            <div className="space-y-4 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:col-span-1">
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Census Load</p>
                  <p className="mt-1 text-xs font-bold text-slate-600 dark:text-slate-300">{occupiedBeds}/{totalBeds} Beds Occupied</p>
                </div>
                <span className={`text-xl font-black ${(occupiedBeds / totalBeds) > 0.8 ? 'text-red-600' : 'text-blue-600'}`}>
                  {Math.round((occupiedBeds / totalBeds) * 100)}%
                </span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full border border-slate-200 bg-slate-100 shadow-inner dark:border-slate-700 dark:bg-slate-800">
                <div 
                  className={`h-full transition-all duration-1000 ease-in-out ${
                    (occupiedBeds / totalBeds) > 0.9 ? 'bg-red-600' : (occupiedBeds / totalBeds) > 0.7 ? 'bg-orange-500' : 'bg-blue-600'
                  }`}
                  style={{ width: `${(occupiedBeds / totalBeds) * 100}%` }}
                />
              </div>
            </div>

            {/* Triage Stats */}
            <div className="lg:col-span-2">
              <TriageStats 
                level1={activeEncounters?.filter(e => e.acuity === 1).length ?? 0}
                level2={activeEncounters?.filter(e => e.acuity === 2).length ?? 0}
                level3={activeEncounters?.filter(e => e.acuity === 3).length ?? 0}
                availableBeds={availableBeds} 
                totalBeds={totalBeds} 
              />
            </div>
          </div>
        </section>

        {/* 4. INTERACTIVE FLOOR PLAN */}
        <section className="rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-900 dark:shadow-slate-950/40">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2">
              <BedDouble className="h-5 w-5 text-blue-600" />
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-slate-100">Real-Time Bed Matrix</h2>
            </div>
            <button onClick={() => confirm("Execute Shift Reset?") && clearBeds()} className="flex items-center gap-2 rounded-lg p-2 text-[10px] font-black uppercase text-red-500 transition-all hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40">
              <Trash2 className="h-3.5 w-3.5" /> Shift Reset
            </button>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-10 gap-4">
            {Array.from({ length: 20 }).map((_, i) => {
              const bedId = `Bed ${i + 1}`;
              const occupant = activeEncounters?.find(e => e.location === bedId);
              return (
                <div key={bedId} onClick={() => {
                  if (occupant) {
                    if (confirm(`Vacate ${bedId}?`)) assignBed({ encounterId: occupant._id, location: "" });
                  } else {
                    const name = prompt(`Assign patient to ${bedId}:`);
                    const p = activeEncounters?.find(e => e.patientName.toLowerCase().includes(name?.toLowerCase() || ""));
                    if (p) assignBed({ encounterId: p._id, location: bedId });
                  }
                }} className={`relative h-24 rounded-2xl border-2 transition-all cursor-pointer flex flex-col items-center justify-center p-3 ${
                  occupant ? "border-blue-600 bg-blue-50/30 shadow-md ring-2 ring-blue-500/10 dark:bg-blue-950/30 dark:ring-blue-400/20" : "border-dashed border-slate-200 hover:border-blue-300 hover:bg-blue-50/20 dark:border-slate-700 dark:hover:border-blue-500/60 dark:hover:bg-blue-950/20"
                }`}>
                  <span className="absolute top-2 left-3 text-[9px] font-black uppercase tracking-tighter text-slate-400 dark:text-slate-500">{bedId}</span>
                  {occupant ? (
                    <div className="flex flex-col items-center gap-1.5 text-center">
                      <div
                        className={`w-full truncate text-[11px] font-black uppercase leading-tight transition-all duration-300 ${
                          isPrivate ? "text-slate-500 dark:text-slate-400" : "text-blue-900 dark:text-blue-200"
                        }`}
                      >
                        {isPrivate
                          ? "PRIVATE PATIENT"
                          : isDemoMode
                            ? formatPatientName(occupant.patientName)
                            : occupant.patientName}
                      </div>
                      <div className="text-[9px] text-slate-400 font-mono">
                        MRN: {isPrivate ? "HIDDEN" : isDemoMode ? "• • • • •" : occupant.mrn}
                      </div>
                      <Badge className={`text-[8px] font-black h-4 px-1 ${occupant.acuity === 1 ? 'bg-red-600 animate-pulse' : 'bg-blue-600'}`}>ESI {occupant.acuity}</Badge>
                    </div>
                  ) : <div className="h-2 w-2 rounded-full bg-slate-200 dark:bg-slate-700" />}
                </div>
              );
            })}
          </div>
        </section>

        {/* 5. ACTIVE TRIAGE QUEUE */}
        <Card className="overflow-hidden rounded-[2.5rem] border-none bg-white shadow-2xl ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
          <CardHeader className="border-b bg-white px-8 py-6 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex justify-between items-center">
              <CardTitle className="flex items-center gap-3 text-xl font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">
                <Activity className="h-5 w-5 text-blue-600" /> Active Triage Queue
              </CardTitle>
              <Badge variant="outline" className="border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-black uppercase text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {filteredEncounters?.length ?? 0} Patients in Census
              </Badge>
            </div>

            {/* Search bar for filtering encounters */}
            {/* Additional filter options can be added here */}
            <div className="mt-4">
              <Input 
                placeholder="Search by patient name or MRN..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-full border-slate-200 bg-slate-100 px-4 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 md:w-1/2 lg:w-1/3"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="border-b bg-slate-50/50 dark:border-slate-800 dark:bg-slate-950/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-24 text-center text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">ESI</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Patient Details</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Wait/Tasks</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Live Vitals</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Clinical Phase</TableHead>
                  <TableHead className="pr-8 text-right text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEncounters?.map((e) => {
                  const waitTime = Math.floor((currentTime - e._creationTime) / 60000);
                  const isCriticalVitals = (e.vitals.spO2 < 92 && e.vitals.spO2 > 0) || e.vitals.hr > 120;
                  const isHrSpiked = e.vitals.previousHr && e.vitals.hr >= e.vitals.previousHr * 1.2;
                  const isHighRisk = isHighRiskComplaint(e.chiefComplaint ?? "");
                  const needsImmediateAttention = e.status === "waiting" && isHighRisk;

                  return (
                    <TableRow key={e._id} className={`h-24 transition-all duration-700 group ${
                      needsImmediateAttention 
                        ? "bg-red-50/80 border-l-4 border-l-red-600 animate-pulse shadow-[inset_0_0_20px_rgba(220,38,38,0.1)] dark:bg-red-950/40" 
                        : e.acuity === 1 || isCriticalVitals 
                          ? "bg-red-50/40 hover:bg-red-50 border-l-12 border-l-red-600 dark:bg-red-950/20 dark:hover:bg-red-950/30"
                          : "hover:bg-slate-50/50 border-l-12 border-l-transparent dark:hover:bg-slate-800/30"
                    }`}>
                      <TableCell className="text-center">
                        <div className={`w-12 h-12 rounded-2xl flex flex-col items-center justify-center shadow-sm mx-auto transition-transform group-hover:scale-110 ${
                          e.acuity === 1 ? "bg-red-600 text-white animate-pulse" : e.acuity === 2 ? "bg-orange-500 text-white" : "bg-yellow-400 text-slate-900"
                        }`}>
                          <span className="text-[10px] font-black leading-none uppercase">ESI</span>
                          <span className="text-xl font-black">{e.acuity}</span>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-3">
                          {needsImmediateAttention && (
                            <div className="h-2 w-2 rounded-full bg-red-600 animate-ping shadow-[0_0_8px_rgb(220,38,38)]" />
                          )}
                          <div>
                            <div className={`font-black transition-all duration-300 ${
                              isPrivate ? "text-slate-500 dark:text-slate-400" : "text-slate-900 dark:text-slate-100"
                            }`}>
                              {isPrivate
                                ? "PRIVATE PATIENT"
                                : isDemoMode
                                  ? formatPatientName(e.patientName)
                                  : e.patientName}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              MRN: {isPrivate ? "HIDDEN" : isDemoMode ? "• • • • •" : e.mrn}
                            </div>
                            {isHighRisk && (
                              <span className="text-[8px] font-black text-red-500 uppercase tracking-widest mt-1 block">
                                ⚠️ High-Risk Chief Complaint
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="mt-1.5 flex items-center gap-2">
                          <button
                            onClick={() => {
                              const b = prompt(`Assign location:`, e.location || "");
                              if (b !== null) assignBed({ encounterId: e._id, location: b });
                            }}
                            className="rounded-full border border-blue-100 bg-blue-50 px-2 py-0.5 text-[9px] font-black uppercase text-blue-600 transition-all hover:bg-blue-600 hover:text-white dark:border-blue-700/40 dark:bg-blue-950/30 dark:text-blue-300"
                          >
                            {e.location || "+ Assign Bed"}
                          </button>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="space-y-2">
                          <div className={`flex items-center gap-1.5 text-xs font-black ${waitTime > 60 ? 'text-red-600' : 'text-slate-600 dark:text-slate-300'}`}>
                            <Clock className="h-3.5 w-3.5" /> {waitTime}m
                          </div>
                          <div className="flex gap-1">
                            <div className="h-1 w-5 rounded-full bg-blue-500" />
                            <div className="h-1 w-5 rounded-full bg-slate-200 dark:bg-slate-700" />
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                          <VitalLabel label="HR" value={e.vitals.hr} alert={e.vitals.hr > 110} trend={isHrSpiked ? 'up' : 'stable'} />
                          <VitalLabel label="BP" value={e.vitals.bp || "---/--"} />
                          <VitalLabel label="O2" value={e.vitals.spO2} alert={e.vitals.spO2 < 93} suffix="%" />
                          <VitalLabel label="T" value={e.vitals.temp} alert={e.vitals.temp > 100.4} suffix="°" />
                        </div>
                      </TableCell>

                      <TableCell>
                        {e.status === "waiting" ? (
                          <button
                            onClick={() => setSelectedTriagePatient(e)}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest animate-pulse hover:bg-slate-900 transition-all shadow-lg shadow-blue-200"
                          >
                            <Activity className="h-3.5 w-3.5" />
                            Perform Triage
                          </button>
                        ) : (
                          <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-4">
                            {e.status}
                          </div>
                        )}
                      </TableCell>

                      <TableCell className="text-right pr-8">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            onClick={() => setVitalsEncounter(e)}
                            className="rounded-lg p-2 text-blue-600 transition-colors hover:bg-blue-50 dark:hover:bg-blue-950/30"
                            title="Update Vitals"
                            aria-label={`Update vitals for ${e.patientName}`}
                          >
                            <Activity className="h-4 w-4" />
                          </button>

                          <Link href={`/patient/${e.patientId}`}>
                            <button className="inline-flex items-center gap-2 rounded-[1.5rem] bg-slate-900 px-6 py-3 text-[10px] font-black uppercase tracking-widest text-white shadow-lg transition-all hover:bg-blue-600 active:scale-95 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-blue-500 dark:hover:text-white">
                              Enter Chart <ArrowUpRight className="h-3.5 w-3.5 text-blue-400" />
                            </button>
                          </Link>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {vitalsEncounter && (
          <VitalsUpdate
            encounter={vitalsEncounter}
            onClose={() => setVitalsEncounter(null)}
          />
        )}
      </div>
    </main>
    </>
  );
}

const isHighRiskComplaint = (complaint: string): boolean => {
  const highRiskKeywords = [
    "chest pain", "cardiac", "heart attack", "myocardial infarction", "mi",
    "stroke", "cva", "neurological deficit", "altered mental status", "confusion",
    "severe headache", "thunderclap headache", "seizure", "convulsion",
    "difficulty breathing", "dyspnea", "respiratory distress", "asthma", "copd", "pneumonia",
    "severe abdominal pain", "abdominal trauma", "penetrating wound", "gunshot", "stab",
    "uncontrolled bleeding", "hemorrhage", "shock", "sepsis", "severe infection",
    "anaphylaxis", "allergic reaction", "severe", "critical", "emergency",
    "overdose", "poisoning", "toxic", "suicide", "self-harm", "trauma",
    "loss of consciousness", "unconscious", "unresponsive", "coma"
  ];
  const lowerComplaint = complaint.toLowerCase();
  return highRiskKeywords.some(keyword => lowerComplaint.includes(keyword));
};

function VitalLabel({ label, value, alert, trend, suffix = "" }: { label: string; value: string | number; alert?: boolean; trend?: "up" | "stable"; suffix?: string; }) {
  if (!value) return <span className="text-[10px] font-bold uppercase text-slate-300 dark:text-slate-600">{label}: --</span>;
  return (
    <div className={`flex items-center gap-1 text-[10px] font-bold uppercase ${alert ? "font-black text-red-600" : "text-slate-600 dark:text-slate-300"}`}>
      {label}: {value}{suffix}
      {trend === "up" && <ArrowUpRight className="h-3 w-3 text-red-500 animate-bounce" />}
      {alert && <div className="h-1 w-1 rounded-full bg-red-600 animate-ping" />}
    </div>
  );
}