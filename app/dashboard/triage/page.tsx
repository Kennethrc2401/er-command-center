"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
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
  MapPin,
  BellRing
} from "lucide-react";
import NewPatientModal from "@/components/NewPatientModal";
import TriageStats from "@/components/TriageStats";

import ShiftSummary from "@/components/ShiftSummary";
import TriageSummaryCard from "@/components/TriageSummaryCard";
import ClinicalAnalytics from "@/components/ClinicalAnalytics";
import SimulateShift from "@/components/Training/SimulateShift";
import ExportReportButton from "@/components/exportReportButton";
import { usePresentationMode } from "@/lib/hooks/usePresentationMode";
import { usePrivacyMode } from "@/lib/hooks/usePrivacyMode";
import TriageHandoffModal from "@/components/handoffs/TriageHandoffModal";
import VitalsUpdate from "@/components/clinical/VitalsUpdate";
import ERAnalytics from "@/components/clinical/ERAnalytics";
import GlobalSearch from "@/components/clinical/GlobalSearch";
import MorningReport from "@/components/clinical/MorningReport";
import ThroughputControlTower from "@/components/clinical/ThroughputControlTower";
import OperationalAlertsPanel from "@/components/clinical/OperationalAlertsPanel";
import ProviderWorkloadPanel from "@/components/clinical/ProviderWorkloadPanel";
import RoomTurnoverMonitor from "@/components/clinical/RoomTurnoverMonitor";
import AssignmentQueue from "@/components/clinical/AssignmentQueue";
import OperationsIntelligenceSuite from "@/components/clinical/OperationsIntelligenceSuite";
import TriageTabs from "@/components/clinical/TriageTabs";
import KioskHandoffQueue from "@/components/kiosk/KioskHandoffQueue";
import { ShiftHandoffPanel } from "@/components/clinical/ShiftHandoffPanel";
import { SignOutPanel } from "@/components/clinical/SignOutPanel";
import ScribeAssistCard from "@/components/clinical/ScribeAssistCard";
import { useAuth } from "@clerk/nextjs";
import { useStaffSession } from "@/lib/hooks/useStaffSession";
import { useResolvedActor } from "@/lib/hooks/useResolvedActor";
import { toast } from "sonner";
import { calculateNEWS2 } from "@/lib/helpers/news2";
import { saveAIToolsPrefill } from "@/lib/helpers/aiTools";

const BED_PREFERENCE_KEY = "triage-bed-matrix-compact";
const SHIFT_OPERATIONS_COLLAPSE_KEY = "triage-shift-operations-collapsed";
const TOTAL_BEDS = 20;
const BED_LOCATION_PATTERN = /^bed\s+(\d+)$/i;

type IncidentTemplate = {
  id: string;
  label: string;
  role: "NURSE" | "DOCTOR" | "UNIT_COORDINATOR";
  message: string;
};

const INCIDENT_TEMPLATES: IncidentTemplate[] = [
  {
    id: "rapid-reassess-bed",
    label: "Rapid Reassessment",
    role: "NURSE",
    message: "Bed assignment requires immediate RN reassessment and repeat vitals within 10 minutes.",
  },
  {
    id: "boarding-bottleneck",
    label: "Boarding Bottleneck",
    role: "UNIT_COORDINATOR",
    message: "Boarding queue threshold breached. Prioritize inpatient placement and escalate transport coordination.",
  },
  {
    id: "critical-provider-review",
    label: "Critical Provider Review",
    role: "DOCTOR",
    message: "High-acuity reassessment requested: evaluate immediate disposition risk and update escalation plan now.",
  },
  {
    id: "imaging-delay",
    label: "Imaging Delay Escalation",
    role: "UNIT_COORDINATOR",
    message: "Critical imaging backlog detected. Coordinate STAT prioritization with radiology and bedside teams.",
  },
];

function normalizeBedLocation(location?: string): string | null {
  if (!location) return null;
  const trimmed = location.trim();
  if (!trimmed) return null;

  const match = BED_LOCATION_PATTERN.exec(trimmed);
  if (!match) return null;

  const bedNumber = Number(match[1]);
  if (!Number.isInteger(bedNumber) || bedNumber < 1 || bedNumber > TOTAL_BEDS) {
    return null;
  }

  return `Bed ${bedNumber}`;
}

export default function Page() {
  const { isSignedIn } = useAuth();
  const staffSession = useStaffSession();
  const isAuthenticated = Boolean(isSignedIn || staffSession.authenticated);

  return (
    <>
      {!isSignedIn && staffSession.loading ? (
        <div className="flex h-[80vh] items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : isAuthenticated ? (
        <ERDashboardContent />
      ) : (
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
          <Link
            href="/staff-login"
            className="bg-blue-600 text-white px-8 py-3 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-100"
          >
            Staff Login
          </Link>
        </div>
      )}
    </>
  );
}

function ERDashboardContent() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState(""); 
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [isShiftOperationsCollapsed, setIsShiftOperationsCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(SHIFT_OPERATIONS_COLLAPSE_KEY) === "1";
  });
  const [incidentTemplateId, setIncidentTemplateId] = useState("custom");
  const [incidentRole, setIncidentRole] = useState<"NURSE" | "DOCTOR" | "UNIT_COORDINATOR">("NURSE");
  const [incidentMessage, setIncidentMessage] = useState("");
  const [isRoutingIncident, setIsRoutingIncident] = useState(false);
  const [isCompactBeds, setIsCompactBeds] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(BED_PREFERENCE_KEY) === "1";
  });
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [selectedTriagePatient, setSelectedTriagePatient] = useState<Doc<"encounters"> | null>(null);
  const [vitalsEncounter, setVitalsEncounter] = useState<Doc<"encounters"> | null>(null);
  const { isDemoMode, toggleDemoMode } = usePresentationMode();
  const staffSession = useStaffSession();
  const { actorName, actorRole, isAdmin } = useResolvedActor();

  const { isPrivate } = usePrivacyMode();

  const activeEncounters = useQuery(api.encounters.getActive);

  const assignBed = useMutation(api.encounters.assignBed);
  const clearBeds = useMutation(api.encounters.clearAllBeds);
  const routeRoleNotification = useMutation(api.workflow.routeRoleNotification);

  const notifyBedAssignmentError = (error: unknown) => {
    const message = error instanceof Error ? error.message : "Unable to assign bed right now.";
    toast.error(message);
  };
  
  const totalBeds = TOTAL_BEDS;
  const allBedIds = useMemo(
    () => Array.from({ length: totalBeds }, (_, index) => `Bed ${index + 1}`),
    [totalBeds]
  );
  const occupiedBedSet = useMemo(() => {
    const occupied = new Set<string>();
    for (const encounter of activeEncounters ?? []) {
      const normalized = normalizeBedLocation(encounter.location);
      if (normalized) occupied.add(normalized);
    }
    return occupied;
  }, [activeEncounters]);
  const occupiedBeds = occupiedBedSet.size;
  const availableBeds = Math.max(0, totalBeds - occupiedBeds);
  const bedGridClasses = isCompactBeds
    ? "grid-cols-[repeat(auto-fit,minmax(112px,1fr))] gap-2 sm:gap-3"
    : "grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3 sm:gap-4";

  const getAssignableBedsForEncounter = (encounterId: Id<"encounters">, currentLocation?: string) => {
    const currentBed = normalizeBedLocation(currentLocation);
    return allBedIds.filter((bedId) => {
      if (bedId === currentBed) return true;
      return !(activeEncounters ?? []).some(
        (encounter) =>
          encounter._id !== encounterId &&
          normalizeBedLocation(encounter.location) === bedId
      );
    });
  };

  // Persist user-selected bed density mode.
  useEffect(() => {
    window.localStorage.setItem(BED_PREFERENCE_KEY, isCompactBeds ? "1" : "0");
  }, [isCompactBeds]);

  useEffect(() => {
    window.localStorage.setItem(SHIFT_OPERATIONS_COLLAPSE_KEY, isShiftOperationsCollapsed ? "1" : "0");
  }, [isShiftOperationsCollapsed]);

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

  const handoffUserId = staffSession.user?.userId ?? null;
  const handoffUserIdSafe = handoffUserId ?? "";
  const canUseHandoffTools = handoffUserIdSafe.length > 0 && (isAdmin || actorRole !== "UNKNOWN");
  const canRouteIncidents = isAdmin || actorRole === "UNIT_COORDINATOR" || actorRole === "NURSE";

  const applyIncidentTemplate = (templateId: string) => {
    setIncidentTemplateId(templateId);
    if (templateId === "custom") return;

    const template = INCIDENT_TEMPLATES.find((item) => item.id === templateId);
    if (!template) return;

    setIncidentRole(template.role);
    setIncidentMessage(template.message);
  };

  const handleRouteIncident = async () => {
    if (!canRouteIncidents) {
      toast.error("Your current role is not permitted to route operational incident alerts");
      return;
    }

    const trimmed = incidentMessage.trim();
    if (!trimmed) {
      toast.error("Add an incident message before routing");
      return;
    }

    setIsRoutingIncident(true);
    try {
      const result = await routeRoleNotification({
        role: incidentRole,
        message: trimmed,
        suppressionWindowMinutes: 15,
      });

      if (result.skipped) {
        toast.info(`Duplicate message suppressed for ${result.suppressionWindowMinutes} minutes`);
      } else {
        toast.success(`Alert routed to ${result.role}`);
      }
      setIncidentMessage("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to route incident notification";
      toast.error(message);
    } finally {
      setIsRoutingIncident(false);
    }
  };

  const sendIncidentToAiTools = () => {
    const summary = incidentMessage.trim();
    saveAIToolsPrefill({
      version: 1,
      target: "handoff",
      handoffSource: [
        `Route Incident Draft`,
        `Role: ${incidentRole}`,
        `Actor: ${actorName}`,
        summary ? `Message: ${summary}` : "Message: [Pending]",
      ].join("\n"),
    });
    void router.push("/dashboard/ai-tools?tool=handoff");
  };

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
            <TriageTabs activeTab="overview" />

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

        <AssignmentQueue />

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

        <ThroughputControlTower isPrivate={isPrivate} isDemoMode={isDemoMode} />

        <OperationsIntelligenceSuite />

        <section className="space-y-5 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Shift Operations</p>
              <h3 className="text-lg font-black tracking-tight text-slate-900 dark:text-slate-100">Handoff + Rapid Routing</h3>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                Acting as {actorName}
              </Badge>
              <button
                onClick={() => setIsShiftOperationsCollapsed((prev) => !prev)}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500 transition-colors hover:border-blue-300 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
              >
                {isShiftOperationsCollapsed ? "Show" : "Hide"}
              </button>
            </div>
          </div>

          {isShiftOperationsCollapsed ? (
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-3 dark:border-slate-700 dark:bg-slate-950/40">
              <Badge className="bg-rose-600 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-white">Rapid Route</Badge>
              <Badge className="bg-blue-600 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-white">Handoff Tools</Badge>
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Templates: {INCIDENT_TEMPLATES.length} • Role Gate: {canRouteIncidents ? "Enabled" : "Restricted"}
              </span>
            </div>
          ) : (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[340px_1fr]">
            <Card className="border-slate-200 dark:border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-slate-700 dark:text-slate-100">
                  <BellRing className="h-4 w-4 text-blue-600" /> Route Incident Alert
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Template</label>
                <select
                  value={incidentTemplateId}
                  onChange={(event) => applyIncidentTemplate(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="custom">Custom Message</option>
                  {INCIDENT_TEMPLATES.map((template) => (
                    <option key={template.id} value={template.id}>{template.label}</option>
                  ))}
                </select>

                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Target Role</label>
                <select
                  value={incidentRole}
                  onChange={(event) => setIncidentRole(event.target.value as "NURSE" | "DOCTOR" | "UNIT_COORDINATOR")}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="NURSE">Nurse Team</option>
                  <option value="DOCTOR">Physician Team</option>
                  <option value="UNIT_COORDINATOR">Unit Coordinator</option>
                </select>

                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Alert Message</label>
                <input
                  value={incidentMessage}
                  onChange={(event) => setIncidentMessage(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  placeholder="Example: Bed 12 requires immediate RN reassessment"
                />

                <ScribeAssistCard
                  mode="ALERT"
                  contextTitle="ER Rapid Incident Route"
                  contextFacts={[
                    `Target Role: ${incidentRole}`,
                    `Actor: ${actorName}`,
                    "Unit: ER 4B",
                  ]}
                  onApply={setIncidentMessage}
                  onRequestCurrentValue={() => incidentMessage}
                />

                <button
                  onClick={() => void handleRouteIncident()}
                  disabled={isRoutingIncident || !incidentMessage.trim() || !canRouteIncidents}
                  className="w-full rounded-xl bg-blue-600 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isRoutingIncident ? "Routing..." : "Send Routed Alert"}
                </button>

                <button
                  onClick={sendIncidentToAiTools}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-700 transition-all hover:border-blue-300 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                >
                  Send To AI Tools Hub
                </button>

                {!canRouteIncidents && (
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                    Routing restricted to ADMIN, UNIT_COORDINATOR, and NURSE roles.
                  </p>
                )}
              </CardContent>
            </Card>

            {canUseHandoffTools ? (
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <SignOutPanel userId={handoffUserIdSafe} userName={actorName} userRole={actorRole} />
                <ShiftHandoffPanel userId={handoffUserIdSafe} userName={actorName} userRole={actorRole} />
              </div>
            ) : (
              <Card className="border-amber-200 bg-amber-50/70 dark:border-amber-700/40 dark:bg-amber-950/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-black uppercase tracking-widest text-amber-800 dark:text-amber-300">Handoff Login Required</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-amber-900 dark:text-amber-200">
                    Shift handoff actions require a staff-session identity with a mapped internal user ID. Use Staff Login to enable sign-out and incoming handoff acceptance tools.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
          )}
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-4">
          <OperationalAlertsPanel />
          <RoomTurnoverMonitor />
          <ProviderWorkloadPanel />
          <KioskHandoffQueue />
        </section>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-8 items-start">
        {/* Main Content: Bed Matrix + Triage Queue */}
        <div className="space-y-8">
        {/* 4. INTERACTIVE FLOOR PLAN */}
        <section className="rounded-[2.5rem] border border-slate-200 bg-white p-4 shadow-xl shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-900 dark:shadow-slate-950/40 sm:p-6">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 sm:mb-8">
            <div className="flex items-center gap-2">
              <BedDouble className="h-5 w-5 text-blue-600" />
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-slate-100">Real-Time Bed Matrix</h2>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                onClick={() => setIsCompactBeds((prev) => !prev)}
                className={`rounded-lg border px-2.5 py-2 text-[9px] font-black uppercase tracking-widest transition-all sm:text-[10px] ${
                  isCompactBeds
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-slate-200 text-slate-600 hover:border-blue-300 hover:bg-blue-50 dark:border-slate-700 dark:text-slate-300 dark:hover:border-blue-500/60 dark:hover:bg-blue-950/20"
                }`}
              >
                {isCompactBeds ? "Dense View" : "Readable View"}
              </button>
              <button onClick={() => confirm("Execute Shift Reset?") && clearBeds()} className="flex items-center gap-2 rounded-lg p-2 text-[9px] font-black uppercase text-red-500 transition-all hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40 sm:text-[10px]">
                <Trash2 className="h-3.5 w-3.5" /> Shift Reset
              </button>
            </div>
          </div>
          
          <div className={`grid ${bedGridClasses}`}>
            {Array.from({ length: totalBeds }).map((_, i) => {
              const bedId = `Bed ${i + 1}`;
              const occupant = activeEncounters?.find((e) => normalizeBedLocation(e.location) === bedId);
              return (
                <div key={bedId} onClick={() => {
                  if (occupant) {
                    if (confirm(`Vacate ${bedId}?`)) {
                      void assignBed({ encounterId: occupant._id, location: "" });
                    }
                  } else {
                    const name = prompt(`Assign patient to ${bedId}:`);
                    const p = activeEncounters?.find(e => e.patientName.toLowerCase().includes(name?.toLowerCase() || ""));
                    if (p) {
                      void assignBed({ encounterId: p._id, location: bedId }).catch(notifyBedAssignmentError);
                    }
                  }
                }} className={`relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 transition-all ${
                  isCompactBeds ? "min-h-24 p-2.5 pt-5" : "min-h-28 p-3 pt-6"
                } ${
                  occupant ? "border-blue-600 bg-blue-50/30 shadow-md ring-2 ring-blue-500/10 dark:bg-blue-950/30 dark:ring-blue-400/20" : "border-dashed border-slate-200 hover:border-blue-300 hover:bg-blue-50/20 dark:border-slate-700 dark:hover:border-blue-500/60 dark:hover:bg-blue-950/20"
                }`}>
                  <span className={`absolute left-3 whitespace-nowrap font-black uppercase tracking-tighter text-slate-400 dark:text-slate-500 ${isCompactBeds ? "top-1.5 text-[8px]" : "top-2 text-[9px]"}`}>{bedId}</span>
                  {occupant ? (
                    <div className={`flex w-full min-w-0 flex-col items-center text-center ${isCompactBeds ? "gap-1" : "gap-1.5"}`}>
                      <div
                        className={`w-full min-w-0 truncate font-black uppercase leading-tight transition-all duration-300 ${isCompactBeds ? "text-[9px] sm:text-[10px]" : "text-[10px] sm:text-[11px]"} ${
                          isPrivate ? "text-slate-500 dark:text-slate-400" : "text-blue-900 dark:text-blue-200"
                        }`}
                      >
                        {isPrivate
                          ? "PRIVATE PATIENT"
                          : isDemoMode
                            ? formatPatientName(occupant.patientName)
                            : occupant.patientName}
                      </div>
                      <div className={`w-full min-w-0 truncate text-center font-mono text-slate-400 ${isCompactBeds ? "text-[8px]" : "text-[9px]"}`}>
                        MRN: {isPrivate ? "HIDDEN" : isDemoMode ? "• • • • •" : occupant.mrn}
                      </div>
                      <Badge className={`font-black ${isCompactBeds ? "h-3.5 px-1 text-[7px]" : "h-4 px-1 text-[8px]"} ${occupant.acuity === 1 ? 'bg-red-600 animate-pulse' : 'bg-blue-600'}`}>ESI {occupant.acuity}</Badge>
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

            <div className="mt-4">
              <GlobalSearch
                onQueryChange={setSearchTerm}
                placeholder="Search by patient name, MRN, or order..."
                className="max-w-none mx-0 md:w-2/3 lg:w-1/2"
              />
              <p className="mt-2 text-[10px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-[0.2em]">
                Press{" "}
                <kbd className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300 shadow-sm mx-0.5">Ctrl</kbd>
                +
                <kbd className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300 shadow-sm mx-0.5">/</kbd>
                {" "}for quick command
              </p>
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
                  <TableHead className="w-28 text-center text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Risk</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Clinical Phase</TableHead>
                  <TableHead className="pr-8 text-right text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEncounters?.map((e) => {
                  const waitTime = Math.floor((currentTime - e._creationTime) / 60000);
                  const isCriticalVitals = (e.vitals.spO2 < 92 && e.vitals.spO2 > 0) || e.vitals.hr > 120;
                  const news2 = calculateNEWS2(e.vitals);
                  const hasEscalatedRisk = news2.score >= 5;
                  const isHrSpiked = e.vitals.previousHr && e.vitals.hr >= e.vitals.previousHr * 1.2;
                  const isHighRisk = isHighRiskComplaint(e.chiefComplaint ?? "");
                  const needsImmediateAttention = e.status === "waiting" && isHighRisk;
                  const currentBed = normalizeBedLocation(e.location);
                  const assignableBeds = getAssignableBedsForEncounter(e._id, e.location);
                  const showNoBedsAvailable = !currentBed && assignableBeds.length === 0;

                  return (
                    <TableRow key={e._id} className={`h-24 transition-all duration-700 group ${
                      needsImmediateAttention 
                        ? "bg-red-50/80 border-l-4 border-l-red-600 animate-pulse shadow-[inset_0_0_20px_rgba(220,38,38,0.1)] dark:bg-red-950/40" 
                        : e.acuity === 1 || isCriticalVitals 
                          ? "bg-red-50/40 hover:bg-red-50 border-l-12 border-l-red-600 dark:bg-red-950/20 dark:hover:bg-red-950/30"
                          : "hover:bg-slate-50/50 border-l-12 border-l-transparent dark:hover:bg-slate-800/30"
                    } ${
                      hasEscalatedRisk
                        ? "shadow-[0_0_0_1px_rgba(239,68,68,0.16),0_0_14px_rgba(239,68,68,0.09)] dark:shadow-[0_0_0_1px_rgba(248,113,113,0.22),0_0_16px_rgba(248,113,113,0.12)]"
                        : ""
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
                          {showNoBedsAvailable ? (
                            <select
                              disabled
                              value=""
                              className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[9px] font-black uppercase text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
                            >
                              <option value="" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">No beds available</option>
                            </select>
                          ) : (
                            <select
                              value={currentBed ?? ""}
                              onChange={(event) => {
                                const nextBed = event.target.value;
                                void assignBed({ encounterId: e._id, location: nextBed }).catch(notifyBedAssignmentError);
                              }}
                              className="rounded-full border border-blue-100 bg-blue-50 px-2 py-0.5 text-[9px] font-black uppercase text-blue-700 transition-all hover:border-blue-300 dark:border-blue-500/60 dark:bg-slate-900 dark:text-blue-200"
                              aria-label={`Assign bed for ${e.patientName}`}
                            >
                              <option value="" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">No bed assigned</option>
                              {assignableBeds.map((bedId) => (
                                <option key={bedId} value={bedId} className="bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">
                                  {bedId === currentBed ? `${bedId} (Current)` : bedId}
                                </option>
                              ))}
                            </select>
                          )}
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

                      <TableCell className="text-center">
                        <div className={`mx-auto inline-flex min-w-16 flex-col items-center rounded-xl border px-2 py-1 ${
                          hasEscalatedRisk
                            ? "border-red-200 bg-red-50 dark:border-red-500/40 dark:bg-red-950/30"
                            : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
                        }`}>
                          <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">NEWS2</span>
                          <span className={`text-lg font-black ${news2.color}`}>{news2.score}</span>
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
        </div>{/* end left column */}

        {/* ER Pulse Sidebar */}
        <div className="space-y-6 xl:sticky xl:top-28">
          <MorningReport />
          <ERAnalytics />
        </div>
        </div>{/* end sidebar grid */}

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