"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { useUser } from "@clerk/nextjs";

// UI Components
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Activity, Pill, History, Beaker, FileText, ClipboardCheck, Loader2, Printer, Scan, Home, AlertCircle, PenTool,
  FileStack,
  ShieldCheck,
  Download,
  Info,
  Search,
  ArrowLeftRight,
  Zap,
  FolderOpen
} from "lucide-react";
import { Button } from "@/components/ui/button";

// Clinical Components
import VitalSignsForm from "@/components/VitalSignsForm";
import MAR from "@/components/MAR";
import OrderMedication from "@/components/OrderMedication";
import LabResults from "@/components/LabResults";
import ClinicalNotes from "@/components/ClinicalNotes";
import DischargeButton from "@/components/DischargeButton";
import VitalsTrend from "@/components/VitalsTrend";
import MedicationHistory from "@/components/MedicationHistory";
import PatientCareSidebar from "@/components/PatientCareSidebar";
import ImagingOrders from "@/components/ImagingOrders";
import TriageAssessment from "@/components/TriageAssessment";
import CriticalLabBanner from "@/components/CriticalLabBanner";
import CodeStatusSelector from "@/components/CodeStatusSelector";
import SBARHandoff from "@/components/SBARHandoff";
import EducationTracker from "@/components/EducationTracker";
import FollowUpCard from "@/components/FollowUpCard";
import ImagingResults from "@/components/ImagingResults";
import PatientTimeline from "@/components/clinical/PatientTimeline";
import DiagnosisSuggester from "@/components/clinical/DiagnosisSuggester";
import { useEffect, useState } from "react";
import CommandBar from "@/components/CommandBar";
import LabTrends from "@/components/LabTrends";
import SmartNotes from "@/components/notes/SmartNotes";
import EKGMonitor from "@/components/Monitors/EKGMonitor";
import InsuranceBadge from "@/components/insurance/InsuranceBadge";
import VirtualInsuranceCard from "@/components/insurance/finances/VirtualInsuranceCard";
import InsuranceFinancials from "@/components/insurance/InsuranceFinancials";
import IdentityVerificationModal from "@/components/insurance/identification/IdentityVerificationModal";
import { toast } from "sonner";
import { usePresentationMode } from "@/lib/hooks/usePresentationMode";
import { useStaffSession } from "@/lib/hooks/useStaffSession";
import { normalizeActorRole } from "@/lib/auth/roles";
import VitalsUpdate from "@/components/clinical/VitalsUpdate";
import VitalsSparkline from "@/components/clinical/VitalsSparkline";
import SBARGenerator from "@/components/clinical/SBARGenerator";
import DischargeSummaryOverlay from "@/components/clinical/DischargeSummary";
import MedicationOrder from "@/components/clinical/MedicationOrder";
import ProtocolLibrary from "@/components/clinical/ProtocolLibrary";
import OperationalAlertsPanel from "@/components/clinical/OperationalAlertsPanel";
import DischargeReadinessPanel from "@/components/clinical/DischargeReadinessPanel";
import BoardingTransferPanel from "@/components/clinical/BoardingTransferPanel";
import OrderEntry from "@/components/clinical/OrderEntry";
import PatientEducation from "@/components/clinical/PatientEducation";
import { PROTOCOL_LIBRARY } from "@/lib/hooks/protocols";
import RiskBadge from "@/components/clinical/RiskBadge";
import AmbientScribe from "@/components/clinical/AmbientScribe";
import TeleConsult from "@/components/appts/TeleConsult";
import SignaturePad from "@/components/clinical/SignaturePad";
import ChartDocumentsPanel from "@/components/clinical/ChartDocumentsPanel";
import OutboundFaxComposer from "@/components/faxes/OutboundFaxComposer";
import PatientInfoTab from "@/components/patient/PatientInfoTab";
import CriticalWorkflowKpiCard from "@/components/clinical/CriticalWorkflowKpiCard";

// DYNAMIC IMPORT: DischargeInlineComponent
const DischargeInlineComponent = dynamic(
  () => import("@/components/DischargeSummary"),
  { 
    ssr: false,
    loading: () => (
      <div className="h-64 flex items-center justify-center border-2 border-dashed rounded-xl bg-slate-50">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
          <p className="text-[10px] font-black uppercase tracking-widest text-center text-slate-400 dark:text-slate-500">
            Finalizing Discharge Module...
          </p>
        </div>
      </div>
    )
  }
);

interface DetailedEncounter extends Omit<Doc<"encounters">, "insurance"> {
  insurance?: Doc<"insurance">;
  estimatedDischargeTime?: number;
}

export default function PatientPage() {
  const params = useParams();
  const patientId = params.id as Id<"patients">;
  const { user } = useUser();
  const staffSession = useStaffSession();
  const staffEmail = user?.primaryEmailAddress?.emailAddress;
  const runDiscovery = useMutation(api.insurance.discoverSecondaryCoverage);
  const runCriticalSweep = useMutation(api.labs.runEscalationSweep);
  const [isSearching, setIsSearching] = useState(false);
  const [activeTab, setActiveTab] = useState("vitals");
  const [showVitalsModal, setShowVitalsModal] = useState(false);
  const [showDischarge, setShowDischarge] = useState(false);
  const [suggestedTriageOrders, setSuggestedTriageOrders] = useState<string[]>([]);
  const [nowTs, setNowTs] = useState(() => Date.now());
  const { isDemoMode, toggleDemoMode } = usePresentationMode();

  useEffect(() => {
    const timerId = setInterval(() => setNowTs(Date.now()), 60_000);
    return () => clearInterval(timerId);
  }, []);

  // --- 2. CONVEX SUBSCRIPTIONS ---
  const patient = useQuery(api.patients.getById, { patientId });
  
  // Use the new JOINED query we discussed
  const encounters = useQuery(api.encounters.getByPatientWithInsurance, { patientId });
  const signedInStaff = useQuery(
    api.users.getByEmail,
    staffEmail ? { email: staffEmail } : "skip"
  );
  const actorName =
    signedInStaff?.name ||
    staffSession.user?.name ||
    user?.fullName ||
    staffEmail ||
    "Clinical Staff";
  const actorRole = normalizeActorRole(
    signedInStaff?.role ||
    staffSession.user?.role
  );
  const teleConsultUserId =
    signedInStaff?._id ??
    (staffSession.user?.userId as Id<"users"> | undefined);
  const isResolvingTeleConsultIdentity = !teleConsultUserId && staffSession.loading;
  const clerkLookupState = !staffEmail
    ? "No Clerk email"
    : signedInStaff?._id
      ? "Matched"
      : "No users record";
  const staffSessionState = staffSession.user?.userId
    ? "Session userId present"
    : "No staff session user";
  
  // Find the active encounter safely
  const activeEncounter = (encounters?.find(e => e.status !== "discharged") || encounters?.[0]) as DetailedEncounter | undefined;
  
  const criticalLabs = useQuery(api.labs.getCriticalAlerts, 
    activeEncounter ? { encounterId: activeEncounter._id } : "skip"
  );

  const gcsScore = useQuery(api.triage.getLatestGCS, 
    activeEncounter ? { encounterId: activeEncounter._id } : "skip"
  );

  const pendingLabsCount = useQuery(api.labs.getPendingCount, 
    activeEncounter ? { encounterId: activeEncounter._id } : "skip"
  ) ?? 0;

  useEffect(() => {
    if (!activeEncounter?._id) return;

    runCriticalSweep({ encounterId: activeEncounter._id }).catch(() => undefined);
    const intervalId = setInterval(() => {
      runCriticalSweep({ encounterId: activeEncounter._id }).catch(() => undefined);
    }, 60_000);

    return () => clearInterval(intervalId);
  }, [activeEncounter?._id, runCriticalSweep]);

  const timelineEvents = useQuery(
    api.encounters.getPatientTimeline,
    activeEncounter ? { encounterId: activeEncounter._id, patientId } : "skip"
  );
  const timelineEventCount = timelineEvents?.length ?? 0;
  const urgentRecentTimelineCount = timelineEvents?.filter((event) => {
    const eventTime = event.time ?? 0;
    const isRecent = eventTime >= nowTs - 60 * 60 * 1000;

    const isStatOrder =
      event.type === "ORDER" && event.description?.includes("STAT");

    const isCriticalVitals =
      event.type === "VITALS" &&
      ((event.description?.match(/HR:\s*(\d+)/)?.[1] !== undefined && Number(event.description?.match(/HR:\s*(\d+)/)?.[1]) >= 120) ||
        (event.description?.match(/O2:\s*(\d+)%/)?.[1] !== undefined && Number(event.description?.match(/O2:\s*(\d+)%/)?.[1]) <= 93));

    return isRecent && (isStatOrder || isCriticalVitals);
  }).length ?? 0;
  const scribeOrders = (timelineEvents ?? [])
    .filter((event) => event.type === "ORDER")
    .map((event) => ({
      testName: event.description?.split(" — ")[0] ?? "Unknown Order",
    }));
  const hasUrgentTimelineEvents = urgentRecentTimelineCount > 0;
  const protocolCount = PROTOCOL_LIBRARY.length;
  const isLegalConsentComplete = Boolean(
    activeEncounter?.patientSignature?.trim() &&
      activeEncounter?.consentToTreatSignedAt &&
      activeEncounter?.hipaaAcknowledgedAt
  );
  const legalSignedAt =
    activeEncounter?.signatureTimestamp ??
    activeEncounter?.consentToTreatSignedAt ??
    activeEncounter?.hipaaAcknowledgedAt;
  const signatureStatusTooltip =
    isLegalConsentComplete && legalSignedAt
      ? `Signed ${new Date(legalSignedAt).toLocaleString()}`
      : "Awaiting legal consent completion";

  // --- 3. LOADING & ERROR STATES ---
  if (!patient || !encounters) {
    return (
      <div className="flex h-screen flex-col items-center justify-center space-y-4 bg-slate-50">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 dark:text-slate-300">Accessing Encrypted Records</p>
      </div>
    );
  }

  if (encounters.length === 0 || !activeEncounter) {
    return (
      <div className="flex h-screen flex-col items-center justify-center space-y-4 bg-white dark:bg-slate-950">
        <History className="h-10 w-10 text-slate-400" />
        <h2 className="text-xl font-black uppercase italic text-slate-800 dark:text-slate-100">No Active Encounter</h2>
        <Button onClick={() => window.history.back()} variant="outline">Return to Census</Button>
      </div>
    );
  }

  // --- 4. CLINICAL LOGIC & CALCULATIONS ---
  const latestVitals = activeEncounter?.vitals;

  const getSystolic = (bpString: string | undefined) => {
    if (!bpString) return 0;
    const systolic = parseInt(bpString.split("/")[0]);
    return isNaN(systolic) ? 0 : systolic;
  };

  const sbp = getSystolic(latestVitals?.bp);
  
  // Refined CCMA Instability Logic
  const isUnstable = latestVitals && (
    latestVitals.hr > 100 || 
    latestVitals.hr < 50 ||
    (latestVitals.spO2 < 94 && latestVitals.spO2 > 0) || 
    sbp > 160 || 
    (sbp < 90 && sbp > 0) ||
    latestVitals.temp > 103
  );

  const getInstabilityReason = () => {
    if (!latestVitals) return "";
    if (latestVitals.hr > 100) return "Tachycardia";
    if (latestVitals.hr < 50) return "Bradycardia";
    if (latestVitals.spO2 < 94 && latestVitals.spO2 > 0) return "Hypoxia";
    if (sbp > 160) return "Severe HTN";
    if (sbp < 90 && sbp > 0) return "Hypotension";
    if (latestVitals.temp > 103) return "Hyperpyrexia";
    return "Critical Vitals";
  };

  const formatPatientName = (name: string) => {
    if (!isDemoMode) return name;

    const parts = name.trim().split(/\s+/);
    if (parts.length > 1) {
      return `${parts[0][0]}. ${parts[1]}`;
    }
    return `Patient-${name.length}${name.charCodeAt(0)}`;
  };

  const maskedMrn = isDemoMode ? "• • • • •" : patient.mrn;
  const maskedDob = isDemoMode ? "--/--/----" : new Date(patient.dob).toLocaleDateString();
  const displayedChiefComplaint = isDemoMode
    ? "Sensitive details hidden in presentation mode"
    : activeEncounter.chiefComplaint;

      const handleDiscovery = async () => {
        setIsSearching(true);
        
        toast.info("Accessing NJ Health Information Exchange...", {
          description: "Querying state Medicaid and Medicare databases...",
        });

        try {
          // 1. Manually create the "fake" delay on the frontend
          await new Promise((resolve) => setTimeout(resolve, 2500));

          // 2. Call the mutation (now fast and error-free!)
          const result = await runDiscovery({ patientId });
          
          setIsSearching(false);

          if (result.success) {
            toast.success("Secondary Coverage Found!", {
              description: `Linked: ${result.provider}. Coordination of Benefits updated.`,
              duration: 5000,
            });
          } else {
            toast.error("No Secondary Coverage Located", {
              description: "Patient verified as Primary Payer only.",
            });
          }
        } catch {
          setIsSearching(false);
          toast.error("System Error", { description: "HIE interface failure." });
        }
      };
      
  return (
    <div className="mx-auto max-w-7xl space-y-6 bg-slate-50/30 p-4 text-slate-900 dark:bg-slate-950/30 dark:text-slate-100 md:p-8">
      
      {criticalLabs && criticalLabs.length > 0 && (
        <CriticalLabBanner alerts={criticalLabs} actorName={actorName} />
      )}

      <CriticalWorkflowKpiCard encounterId={activeEncounter._id} />

      {showVitalsModal && (
        <VitalsUpdate
          encounter={{
            _id: activeEncounter._id,
            patientId: activeEncounter.patientId,
            acuity: activeEncounter.acuity,
            vitals: activeEncounter.vitals,
          }}
          onClose={() => setShowVitalsModal(false)}
        />
      )}

      {/* HEADER */}
      <header className="relative flex flex-col justify-between gap-4 overflow-hidden rounded-[2.5rem] border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:flex-row">
        {isUnstable && <div className="absolute top-0 left-0 w-full h-1 bg-red-500 animate-pulse" />}

        <div className="flex items-center gap-5">
          {latestVitals && (
            <div className="shrink-0">
              <p className="mb-1 text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Clinical Risk</p>
              <RiskBadge vitals={latestVitals} />
            </div>
          )}

          <div className="h-16 w-16 rounded-2xl bg-slate-900 flex items-center justify-center text-white font-black text-2xl shadow-xl shadow-slate-200 uppercase italic">
            {isDemoMode ? "P" : patient.name.charAt(0)}
          </div>
          <div className="text-left">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-black uppercase italic tracking-tighter text-slate-900 dark:text-slate-100">
                {formatPatientName(patient.name)}
              </h1>
              {isUnstable && (
                <Badge className="bg-red-600 text-white animate-bounce border-none px-2 py-1 text-[9px] font-black uppercase tracking-widest">
                  <AlertCircle className="h-3 w-3 mr-1" /> {getInstabilityReason()}
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-2 items-center mt-1">
              <span className="rounded border border-slate-100 bg-slate-50 px-2 py-0.5 font-mono text-[10px] font-black tracking-tighter text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                MRN: {maskedMrn}
              </span>
              <CodeStatusSelector patientId={patientId} currentStatus={patient.codeStatus || "Full Code"} />
              <span className="rounded border border-blue-100 bg-blue-50 px-2 py-0.5 text-[10px] font-black uppercase italic text-blue-600 dark:border-blue-700/40 dark:bg-blue-950/30 dark:text-blue-300">
                DOB: {maskedDob}
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex flex-col items-end gap-3">
          <div className="flex gap-2">
            {isDemoMode ? (
              <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-[9px] font-black uppercase italic tracking-widest text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                Allergy Data Hidden
              </span>
            ) : patient.allergies.length > 0 ? (
              patient.allergies.map(allergy => (
                <span key={allergy} className="px-3 py-1 bg-red-600 text-white text-[9px] font-black rounded-full animate-pulse tracking-widest uppercase shadow-lg shadow-red-200">
                  ⚠️ {allergy}
                </span>
              ))
            ) : (
              <span className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[9px] font-black uppercase italic tracking-widest text-emerald-600 dark:border-emerald-700/40 dark:bg-emerald-950/30 dark:text-emerald-300">
                NKDA
              </span>
            )}
          </div>
          <div className="flex w-full flex-wrap justify-end gap-2 md:w-auto">
             {activeTab !== "vitals" && (
               <button
                 onClick={() => setShowVitalsModal(true)}
                 className="flex-1 min-w-35 rounded-2xl bg-slate-900 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white shadow-lg transition-all hover:bg-slate-800 md:flex-none"
               >
                 Update Vitals
               </button>
             )}
             <OrderMedication patientId={patientId} encounterId={activeEncounter._id} patientAllergies={patient.allergies} />
             <OutboundFaxComposer
               triggerLabel="Send Packet"
               defaultPatientId={patientId}
               defaultEncounterId={activeEncounter._id}
               defaultSubject="ED Clinical Packet"
               buttonClassName="flex-1 min-w-35 rounded-2xl bg-blue-600 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white shadow-lg transition-all hover:bg-blue-500 md:flex-none"
             />
             <DischargeButton encounterId={activeEncounter._id} />
          </div>
        </div>
      </header>

      {/* WORKSPACE GRID */}
      <div className="grid grid-cols-1 gap-6 items-start lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8 xl:col-span-9">
          <div className="flex justify-end">
            <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-2 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <span className={`text-[9px] font-black uppercase tracking-widest ${isDemoMode ? 'text-blue-600' : 'text-slate-400 dark:text-slate-500'}`}>
                {isDemoMode ? "Presentation Mode: ON" : "Normal Mode"}
              </span>
              <button
                onClick={toggleDemoMode}
                className={`relative h-6 w-12 rounded-full transition-colors duration-300 ${isDemoMode ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'}`}
              >
                <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform duration-300 ${isDemoMode ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
            </div>
          </div>
          <CommandBar setTab={setActiveTab} />
          
          <Tabs defaultValue={activeTab} value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid h-auto group-data-[orientation=horizontal]/tabs:h-auto w-full grid-cols-4 gap-1 rounded-[2rem] border border-slate-200 bg-slate-100/80 p-1.5 dark:border-slate-700 dark:bg-slate-900/80 sm:grid-cols-6 lg:grid-cols-7">
              {[
                { value: "vitals", icon: Activity, label: "Vitals", badge: 0 },
                { value: "info", icon: Info, label: "Info", badge: 0 },
                { value: "triage", icon: ClipboardCheck, label: "Triage", badge: 0 },
                { value: "labs", icon: Beaker, label: "Labs", badge: pendingLabsCount },
                { value: "imaging", icon: Scan, label: "Imaging", badge: 0 },
                { value: "mar", icon: Pill, label: "MAR", badge: 0 },
                { value: "notes", icon: FileText, label: "Notes", badge: 0 },
                { value: "documents", icon: FolderOpen, label: "Documents", badge: 0 },
                { value: "billing", icon: FileStack, label: "Billing", badge: 0 },
                { value: "signature", icon: PenTool, label: "Signature", badge: 0 },
                { value: "discharge", icon: Home, label: "Discharge", badge: 0 },
                { value: "handoff", icon: ArrowLeftRight, label: "Handoff", badge: 0 },
                { value: "ekg", icon: Zap, label: "EKG", badge: 0 },
              ].map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="relative flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2.5 text-[10px] font-black uppercase italic tracking-wide transition-all data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm dark:text-slate-300 dark:data-[state=active]:bg-slate-950 dark:data-[state=active]:text-blue-400 sm:py-3 sm:px-3 sm:text-[11px]"
                >
                  <tab.icon className="size-4 shrink-0" />
                  <span>{tab.label}</span>
                  {tab.value === "signature" ? (
                    <span
                      title={signatureStatusTooltip}
                      aria-label={signatureStatusTooltip}
                      className={`rounded-full px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide leading-tight ${
                        isLegalConsentComplete
                          ? "bg-emerald-600 text-white dark:bg-emerald-500"
                          : "bg-slate-300 text-slate-700 dark:bg-slate-700 dark:text-slate-200"
                      }`}
                    >
                      {isLegalConsentComplete ? "SIGNED" : "PENDING"}
                    </span>
                  ) : tab.badge > 0 ? (
                    <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[8px] font-bold text-white animate-pulse">{tab.badge}</span>
                  ) : null}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="info" className="space-y-6 animate-in fade-in-50 pt-4 outline-none">
              <PatientInfoTab patientId={patientId} patient={patient} />
            </TabsContent>

            {/* VITALS & ADMINISTRATIVE TAB */}
           <TabsContent value="vitals" className="space-y-6 animate-in fade-in-50 pt-4 outline-none">
            {/* TOP ROW: CLINICAL CORE */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-1">
                <VitalSignsForm encounterId={activeEncounter._id} />
              </div>
              <div className="xl:col-span-2">
                <VitalsTrend encounterId={activeEncounter._id} actorName={actorName} actorRole={actorRole} />
              </div>
            </div>

            {/* MIDDLE ROW: ADMINISTRATIVE SUITE (Cleaned & Responsive) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* LEFT: Eligibility & Identity Audit (7 Cols) */}
              <div className="lg:col-span-7 space-y-4">
                <div className="flex items-center gap-2 px-2">
                  <div className="h-1 w-6 bg-blue-500 rounded-full" />
                  <h3 className="text-[10px] font-black uppercase italic tracking-[0.2em] text-slate-400 dark:text-slate-500">Insurance & Eligibility Audit</h3>
                </div>
                
                <div className="space-y-4 rounded-[2.5rem] border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <InsuranceBadge 
                    encounterId={activeEncounter._id} 
                    insurance={activeEncounter.insurance} 
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {activeEncounter.insurance && (
                      <IdentityVerificationModal 
                        patient={{
                          name: formatPatientName(patient.name),
                          dob: isDemoMode ? "2000-01-01" : patient.dob,
                        }} 
                        insurance={activeEncounter.insurance} 
                      />
                    )}
                    
                    <button 
                      onClick={handleDiscovery}
                      disabled={isSearching}
                      className="flex items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 transition-all hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                    >
                      {isSearching ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />} 
                      {isSearching ? "Querying HIE..." : "Check Secondary"}
                    </button>
                  </div>
                </div>
              </div>

              {/* RIGHT: Financial Counseling (5 Cols) */}
              <div className="lg:col-span-5 space-y-4">
                <div className="flex items-center gap-2 px-2">
                  <div className="h-1 w-6 bg-emerald-500 rounded-full" />
                  <h3 className="text-[10px] font-black uppercase italic tracking-[0.2em] text-slate-400 dark:text-slate-500">Financial Counseling</h3>
                </div>
                
                <div className="space-y-3">
                  {activeEncounter.insurance && (
                    <InsuranceFinancials insurance={activeEncounter.insurance} />
                  )}
                  
                  {/* COMPLIANCE STATUS */}
                  <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-emerald-500 rounded-lg text-white">
                        <ShieldCheck className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <p className="text-[9px] font-black uppercase text-emerald-800 leading-none">Identity Secured</p>
                        <p className="text-[8px] font-bold text-emerald-600/70 mt-1 uppercase">Red Flag Rule Audit Passed</p>
                      </div>
                    </div>
                    <button className="text-[9px] font-black uppercase text-emerald-700 underline underline-offset-4 hover:text-emerald-900">
                      Audit Log
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* BOTTOM ROW: DOCUMENTATION */}
            <Card className="overflow-hidden rounded-[2.5rem] border-slate-200 bg-slate-50/50 shadow-sm dark:border-slate-800 dark:bg-slate-950/50">
              <div className="bg-slate-900 px-8 py-4 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                  <span className="text-[9px] font-black uppercase italic tracking-[0.3em] text-slate-400 dark:text-slate-500">AI Clinical Scribe v2.0</span>
                </div>
                <Badge className="bg-white/10 text-slate-400 border-none text-[8px] font-black tracking-widest uppercase py-0.5">Real-Time Sync</Badge>
              </div>
              <CardContent className="p-6">
                <SmartNotes encounterId={activeEncounter._id} />
              </CardContent>
            </Card>
          </TabsContent> 

            <TabsContent value="triage" className="pt-4 space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2"><TriageAssessment encounterId={activeEncounter._id} /></div>
                <div className="lg:col-span-1 space-y-6">
                  <Card className="rounded-[2.5rem] border-amber-100 bg-amber-50/30 shadow-sm dark:border-amber-700/30 dark:bg-amber-950/20 overflow-hidden">
                    <div className="bg-amber-600 px-6 py-3">
                      <span className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-50 italic">Clinical Decision Support</span>
                    </div>
                    <CardContent className="p-6">
                      <DiagnosisSuggester
                        encounter={activeEncounter}
                        onSelectDiagnosis={setSuggestedTriageOrders}
                      />
                    </CardContent>
                  </Card>
                  <OrderEntry
                    patientId={patientId}
                    encounterId={activeEncounter._id}
                    suggestedOrders={suggestedTriageOrders}
                  />
                  {teleConsultUserId ? (
                    <TeleConsult
                      encounterId={activeEncounter._id}
                      patientId={patientId}
                      userId={teleConsultUserId}
                    />
                  ) : isResolvingTeleConsultIdentity ? (
                    <Card className="rounded-[2rem] border border-slate-200 bg-slate-100/60 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/50">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-300">
                        Resolving staff identity for tele-consult...
                      </p>
                    </Card>
                  ) : (
                    <Card className="rounded-[2rem] border border-slate-200 bg-slate-100/60 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/50">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-300">
                        Tele-Consult unavailable: resolve staff identity to page specialist.
                      </p>
                      <div className="mt-3 space-y-1 rounded-xl border border-slate-200 bg-white/70 p-2 dark:border-slate-700 dark:bg-slate-800/50">
                        <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Identity Diagnostics</p>
                        <p className="text-[9px] font-bold text-slate-500 dark:text-slate-300">Clerk Lookup: {clerkLookupState}</p>
                        <p className="text-[9px] font-bold text-slate-500 dark:text-slate-300">Staff Session: {staffSessionState}</p>
                      </div>
                    </Card>
                  )}
                  <OperationalAlertsPanel encounterId={activeEncounter._id} />
                </div>
              </div>
            </TabsContent>
            <TabsContent value="labs" className="pt-4">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                  <LabResults encounterId={activeEncounter._id} />

                  <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
                    <Tabs defaultValue="timeline" className="w-full">
                      <TabsList className="grid w-full grid-cols-2 rounded-2xl bg-slate-100/90 p-1.5 dark:bg-slate-800/80">
                        <TabsTrigger value="timeline" className="rounded-xl px-2 py-2.5 text-[10px] font-black uppercase tracking-wide sm:text-[11px]">
                          <span className="flex items-center gap-1.5">
                            Timeline
                            <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-black text-white ${
                              hasUrgentTimelineEvents ? "bg-red-500 animate-pulse" : "bg-blue-500"
                            }`}>
                              {timelineEventCount}
                            </span>
                            {hasUrgentTimelineEvents && (
                              <span
                                className="rounded-full bg-red-50 px-1.5 py-0.5 text-[8px] font-black text-red-600 dark:bg-red-900/30 dark:text-red-300"
                                title="Urgent events in last 60 minutes"
                                aria-label="Urgent events in last 60 minutes"
                              >
                                {urgentRecentTimelineCount}
                              </span>
                            )}
                          </span>
                        </TabsTrigger>
                        <TabsTrigger value="protocols" className="rounded-xl px-2 py-2.5 text-[10px] font-black uppercase tracking-wide sm:text-[11px]">
                          <span className="flex items-center gap-1.5">
                            Protocols
                            <span className="rounded-full bg-slate-600 px-1.5 py-0.5 text-[8px] font-black text-white dark:bg-slate-500">
                              {protocolCount}
                            </span>
                          </span>
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="timeline" className="mt-4 max-h-128 overflow-y-auto pr-1 sm:pr-2">
                        <PatientTimeline encounterId={activeEncounter._id} patientId={patientId} />
                      </TabsContent>

                      <TabsContent value="protocols" className="mt-4 max-h-128 overflow-y-auto pr-1 sm:pr-2">
                        <ProtocolLibrary encounterId={activeEncounter._id} patientId={patientId} activatedBy={actorName} />
                      </TabsContent>
                    </Tabs>
                  </div>
                </div>
                <div className="lg:col-span-1"><LabTrends encounterId={activeEncounter._id} /></div>
              </div>
            </TabsContent>
            <TabsContent value="imaging" className="pt-4">
               <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-1"><ImagingOrders encounterId={activeEncounter._id} actorName={actorName} /></div>
                  <div className="lg:col-span-2"><ImagingResults encounterId={activeEncounter._id} /></div>
               </div>
            </TabsContent>
            <TabsContent value="mar" className="pt-4 space-y-6">
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
                <div className="xl:col-span-8 space-y-6">
                  <MedicationHistory encounterId={activeEncounter._id} />
                  <MAR encounterId={activeEncounter._id} patientAllergies={patient.allergies} />
                </div>
                <div className="xl:col-span-4">
                  <MedicationOrder
                    patient={{
                      allergies: isDemoMode ? [] : patient.allergies,
                    }}
                  />
                </div>
              </div>
            </TabsContent>
            <TabsContent value="notes" className="pt-4">
               <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2 space-y-6">
                    <ClinicalNotes encounterId={activeEncounter._id} />

                    <div className="space-y-3">
                      <div className="flex items-center gap-2 px-1">
                        <div className="h-1 w-6 rounded-full bg-rose-500" />
                        <h3 className="text-[10px] font-black uppercase italic tracking-[0.2em] text-slate-400 dark:text-slate-500">
                          Final Assessment Step Before Discharge
                        </h3>
                      </div>
                      <AmbientScribe
                        patient={{
                          name: formatPatientName(patient.name),
                          gender: patient.gender,
                          medicalHistory: patient.medicalHistory,
                        }}
                        encounter={{
                          chiefComplaint: displayedChiefComplaint,
                          acuity: activeEncounter.acuity,
                          vitals: activeEncounter.vitals,
                        }}
                        orders={scribeOrders}
                          encounterId={activeEncounter._id}
                        />

                      <div className="flex justify-end">
                        <Button
                          onClick={() => setActiveTab("discharge")}
                          variant="outline"
                          className="rounded-2xl border-slate-300 bg-white px-5 py-2 text-[10px] font-black uppercase tracking-widest text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          Continue to Discharge Summary
                        </Button>
                      </div>
                    </div>
                  </div>
                <div className="lg:col-span-1"><SBARHandoff patient={{ ...patient, name: formatPatientName(patient.name), mrn: maskedMrn, dob: isDemoMode ? "" : patient.dob, allergies: isDemoMode ? [] : patient.allergies }} encounter={{ ...activeEncounter, chiefComplaint: displayedChiefComplaint }} gcs={gcsScore} criticalLabs={criticalLabs || []} /></div>
               </div>
            </TabsContent>

            <TabsContent value="documents" className="pt-4 space-y-6 animate-in fade-in-50">
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-[10px] font-black uppercase italic tracking-[0.2em] text-slate-500 dark:text-slate-300">
                    Chart Files and Outside Records
                  </h3>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="border-slate-200 text-[8px] font-black uppercase tracking-wide">
                      Documents Hub
                    </Badge>
                    <OutboundFaxComposer
                      triggerLabel="Route Document"
                      defaultPatientId={patientId}
                      defaultEncounterId={activeEncounter._id}
                      defaultSubject="Requested ED Records"
                    />
                  </div>
                </div>
                <ChartDocumentsPanel
                  encounterId={activeEncounter._id}
                  patientId={patientId}
                  uploadedBy={actorName}
                  actorRole={actorRole}
                />
              </div>
            </TabsContent>

              <TabsContent value="billing" className="space-y-6 animate-in fade-in-50 pt-4">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                  
                  {/* LEFT COLUMN: INSURANCE & AUTHORIZATION (2/3) */}
                  <div className="lg:col-span-2 space-y-6">
                    {/* 1. Virtual Insurance Card Section */}
                    {activeEncounter.insurance && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between px-2">
                          <h3 className="text-xs font-black uppercase italic tracking-[0.2em] text-slate-400 dark:text-slate-500">Document Imaging</h3>
                          <Badge variant="outline" className="text-[8px] font-black border-slate-200">SCAN_REF: 992834</Badge>
                        </div>
                        <VirtualInsuranceCard 
                          insurance={activeEncounter.insurance} 
                          patientName={formatPatientName(patient.name)} 
                        />
                      </div>
                    )}

                    {/* 2. Detailed Eligibility Response */}
                    <Card className="overflow-hidden rounded-[2.5rem] border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                      <div className="bg-slate-900 p-4 flex justify-between items-center">
                        <span className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">EDI 271 Transaction Detail</span>
                        <span className="text-[9px] font-mono text-slate-500 uppercase">Gateway: Availity v5.1</span>
                      </div>
                      <CardContent className="p-8">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
                          <div className="space-y-1">
                            <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Plan Type</Label>
                            <p className="text-sm font-bold text-slate-900 dark:text-slate-100">Commercial PPO</p>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Effective Date</Label>
                            <p className="text-sm font-bold text-slate-900 dark:text-slate-100">01/01/2026</p>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Coordination of Benefits</Label>
                            <p className="text-sm font-bold text-blue-600">Primary</p>
                          </div>
                        </div>

                        <div className="mt-8 grid grid-cols-1 gap-8 border-t border-slate-100 pt-8 dark:border-slate-800 md:grid-cols-2">
                          <div className="space-y-4">
                            <div className="flex items-center gap-2">
                              <ShieldCheck className="h-4 w-4 text-emerald-500" />
                              <span className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-slate-100">Prior Auth Required</span>
                            </div>
                            <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-300">
                              Prior authorization is <span className="font-bold text-slate-900 underline dark:text-slate-100">REQUIRED</span> for advanced imaging (CT/MRI) and inpatient stays exceeding 23 hours.
                            </p>
                          </div>
                          <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                            <div>
                              <p className="text-[9px] font-black uppercase text-slate-400 dark:text-slate-500">Auth Case ID</p>
                              <p className="text-sm font-mono font-bold text-slate-900 dark:text-slate-100">AUTH-PEND-772</p>
                            </div>
                            <Button variant="outline" size="sm" className="rounded-xl font-black text-[9px] uppercase tracking-tighter">Update Status</Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* RIGHT COLUMN: FINANCIAL COUNSELING (1/3) */}
                  <div className="lg:col-span-1 space-y-6 lg:sticky lg:top-8">
                    {/* 3. POS Collections Card */}
                    {activeEncounter.insurance && <InsuranceFinancials insurance={activeEncounter.insurance as NonNullable<typeof activeEncounter.insurance>} />}

                    {/* 4. Billing Narrative Note */}
                    <Card className="rounded-[2.5rem] border-amber-100 bg-amber-50/30 p-6 dark:border-amber-700/30 dark:bg-amber-950/20">
                      <h4 className="text-[10px] font-black uppercase text-amber-800 mb-4 flex items-center gap-2 tracking-widest italic">
                        <Info className="h-4 w-4" /> Registrar&apos;s Note
                      </h4>
                      <textarea 
                        placeholder="Log insurance-related discussions or secondary coverage info..."
                        className="h-32 w-full rounded-2xl border border-amber-200 bg-white/50 p-4 text-xs font-medium outline-none transition-all placeholder:text-amber-200 focus:ring-2 focus:ring-amber-400 dark:border-amber-700/40 dark:bg-slate-900/50 dark:text-slate-100 dark:placeholder:text-amber-800"
                      />
                      <Button className="w-full mt-4 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-black text-[10px] uppercase tracking-widest italic shadow-lg shadow-amber-200/50">
                        Save Admin Note
                      </Button>
                    </Card>

                    {/* 5. Quick Actions */}
                    <div className="grid grid-cols-1 gap-3">
                      <Button variant="outline" className="group rounded-2xl border-slate-200 py-6 text-[10px] font-black uppercase tracking-widest dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                        <Download className="h-4 w-4 mr-2 group-hover:translate-y-0.5 transition-transform" /> Download Face Sheet
                      </Button>
                      <Button variant="outline" className="group rounded-2xl border-slate-200 py-6 text-[10px] font-black uppercase tracking-widest dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                        <Printer className="h-4 w-4 mr-2 group-hover:-translate-y-0.5 transition-transform" /> Print ID Stickers
                      </Button>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="signature" className="pt-4 space-y-6 animate-in fade-in-50">
                <div className="mx-auto max-w-3xl space-y-4">
                  <div className="rounded-3xl border border-slate-200 bg-slate-100/50 p-4 dark:border-slate-700 dark:bg-slate-900/50">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-300">
                      Legal Consent Capture: Consent to Treat + HIPAA Acknowledgement
                    </p>
                  </div>
                  <SignaturePad encounterId={activeEncounter._id} />
                </div>
              </TabsContent>

            <TabsContent value="handoff" className="pt-4 space-y-6 animate-in fade-in-50">
              <div className="max-w-2xl mx-auto">
                <SBARGenerator
                  patient={{
                    name: formatPatientName(patient.name),
                    mrn: maskedMrn,
                    gender: patient.gender,
                    medicalHistory: patient.medicalHistory,
                    allergies: isDemoMode ? [] : patient.allergies,
                  }}
                  encounter={{
                    chiefComplaint: displayedChiefComplaint,
                    acuity: activeEncounter.acuity,
                    status: activeEncounter.status,
                    vitals: {
                      hr: activeEncounter.vitals.hr,
                      bp: activeEncounter.vitals.bp,
                      spO2: activeEncounter.vitals.spO2,
                      temp: activeEncounter.vitals.temp,
                    },
                  }}
                />
              </div>
            </TabsContent>

            {/* ── EKG MONITOR TAB ──────────────────────────────────────────── */}
            <TabsContent value="ekg" className="pt-4 space-y-6 animate-in fade-in-50">
              {/* Quick vitals strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Heart Rate",     value: String(activeEncounter.vitals.hr),          unit: "bpm",  warn: activeEncounter.vitals.hr < 50 || activeEncounter.vitals.hr > 130 },
                  { label: "Blood Pressure", value: activeEncounter.vitals.bp ?? "—",            unit: "mmHg", warn: false },
                  { label: "SpO₂",           value: String(activeEncounter.vitals.spO2 ?? "—"),  unit: "%",    warn: (activeEncounter.vitals.spO2 ?? 100) < 92 },
                  { label: "Temp",           value: String(activeEncounter.vitals.temp ?? "—"),  unit: "°F",   warn: (activeEncounter.vitals.temp ?? 98.6) > 100.4 || (activeEncounter.vitals.temp ?? 98.6) < 96 },
                ].map(({ label, value, unit, warn }) => (
                  <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 flex flex-col gap-1">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</span>
                    <div className="flex items-baseline gap-1">
                      <span className={`text-xl font-black tabular-nums ${warn ? "text-red-500" : "text-slate-800 dark:text-slate-100"}`}>{value}</span>
                      <span className="text-[9px] text-slate-400">{unit}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Full-width EKG monitor */}
              <EKGMonitor bpm={activeEncounter.vitals.hr} isUnstable={isUnstable} />

              {/* Rhythm interpretation card */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 space-y-3">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-blue-500" />
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">Rhythm Interpretation</h3>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-2 text-[11px]">
                  <div>
                    <span className="text-slate-400 font-bold">Rhythm: </span>
                    <span className="font-black text-slate-700 dark:text-slate-200">
                      {isUnstable ? "Atrial Fibrillation" : activeEncounter.vitals.hr < 60 ? "Sinus Bradycardia" : activeEncounter.vitals.hr > 100 ? "Sinus Tachycardia" : "Normal Sinus Rhythm"}
                    </span>
                  </div>
                  <div><span className="text-slate-400 font-bold">Rate: </span><span className="font-black text-slate-700 dark:text-slate-200">{activeEncounter.vitals.hr} bpm</span></div>
                  <div><span className="text-slate-400 font-bold">P waves: </span><span className={`font-black ${isUnstable ? "text-red-500" : "text-emerald-600"}`}>{isUnstable ? "Absent" : "Present"}</span></div>
                  <div><span className="text-slate-400 font-bold">ST segment: </span><span className={`font-black ${isUnstable ? "text-red-500" : "text-emerald-600"}`}>{isUnstable ? "Depression noted" : "Isoelectric"}</span></div>
                </div>
                {isUnstable && (
                  <div className="mt-1 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 dark:border-red-800/40 dark:bg-red-950/30">
                    <p className="text-[11px] font-bold text-red-600 dark:text-red-400">
                      ⚠ Irregular rhythm detected. Consider rate control, anticoagulation assessment, and cardiology consult per protocol.
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="discharge" className="pt-4 space-y-6">
              <div className="flex items-center justify-between rounded-3xl border border-slate-200 bg-slate-100/50 p-4 dark:border-slate-700 dark:bg-slate-900/50">
                <span className="flex items-center gap-2 text-[10px] font-black uppercase italic tracking-widest text-slate-500 dark:text-slate-300">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> Final Safety Handoff
                </span>
                <div className="flex items-center gap-2">
                  <OutboundFaxComposer
                    triggerLabel="Fax Discharge Packet"
                    defaultPatientId={patientId}
                    defaultEncounterId={activeEncounter._id}
                    defaultSubject="ED Discharge Packet"
                    buttonClassName="rounded-xl bg-emerald-600 px-4 py-2 text-[10px] font-black uppercase text-white hover:bg-emerald-500"
                  />
                  <Button
                    onClick={() => setShowDischarge(true)}
                    size="sm"
                    className="rounded-xl bg-blue-600 text-[10px] font-black uppercase text-white hover:bg-blue-700"
                  >
                    <Printer className="mr-2 h-3.5 w-3.5" /> Generate Discharge Papers
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-8 xl:grid-cols-12">
                <div className="space-y-6 xl:col-span-8">
                  <FollowUpCard appt={{ followUpDate: activeEncounter.estimatedDischargeTime ? new Date(activeEncounter.estimatedDischargeTime).toISOString().split('T')[0] : undefined, provider: "", specialty: "", time: "", address: "" }} />
                  <DischargeInlineComponent encounterId={activeEncounter._id} />
                  <BoardingTransferPanel encounter={activeEncounter} />
                </div>
                <div className="space-y-6 xl:col-span-4">
                  <DischargeReadinessPanel encounterId={activeEncounter._id} />
                  <EducationTracker encounterId={activeEncounter._id} />
                  <PatientEducation
                    encounter={{
                      _id: activeEncounter._id,
                      chiefComplaint: displayedChiefComplaint,
                    }}
                    patient={{
                      name: formatPatientName(patient.name),
                      mrn: maskedMrn,
                    }}
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* SIDEBAR */}
        <aside className="flex flex-col gap-5 pb-8 lg:col-span-4 xl:col-span-3 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto">

          {/* Patient Status Card — HR + ER Context merged */}
          <Card className="border-0 shadow-xl rounded-[2rem] overflow-hidden bg-slate-900 text-white shrink-0">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-700/50 pb-3">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Patient Status</span>
                <Badge className="bg-emerald-500 text-white border-none text-[8px] font-black">ACTIVE</Badge>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[8px] font-black uppercase text-slate-500 mb-0.5 tracking-tighter">Heart Rate</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-black tracking-tighter">{activeEncounter.vitals.hr}</span>
                    <span className="text-[9px] font-bold opacity-60 uppercase text-slate-400">BPM</span>
                  </div>
                </div>
                <VitalsSparkline
                  data={patient?.vitalsHistory ?? []}
                  color={activeEncounter.vitals.hr > 100 ? "#ef4444" : "#3b82f6"}
                />
              </div>
              <div className="flex justify-between border-t border-slate-700/40 pt-3">
                <div><Label className="text-[9px] font-black uppercase text-slate-500 block">GCS</Label><span className="text-xl font-black">{gcsScore ?? "15"}</span></div>
                <div className="text-right"><Label className="text-[9px] font-black uppercase text-slate-500 block">ESI</Label><span className="text-xl font-black text-blue-400">{activeEncounter.acuity}</span></div>
              </div>
              <div>
                <Label className="text-[9px] font-black uppercase text-slate-500 block mb-1">Chief Complaint</Label>
                <p className="text-xs font-bold italic text-slate-200 border-l-2 border-blue-500 pl-3">&quot;{displayedChiefComplaint}&quot;</p>
              </div>
            </CardContent>
          </Card>

          <EKGMonitor bpm={activeEncounter.vitals.hr} isUnstable={isUnstable} />
          <PatientCareSidebar
            patientId={patientId}
            encounterId={activeEncounter._id}
            onOpenPatientInfo={() => setActiveTab("info")}
          />
        </aside>
      </div>

      {/* FULL-SCREEN DISCHARGE OVERLAY */}
      {showDischarge && (
        <DischargeSummaryOverlay
          patient={{
            name: formatPatientName(patient.name),
            gender: patient.gender,
            dob: isDemoMode ? "2000-01-01" : patient.dob,
            mrn: maskedMrn,
          }}
          encounter={{
            chiefComplaint: displayedChiefComplaint,
            vitals: activeEncounter.vitals,
            _id: activeEncounter._id,
            patientSignature: activeEncounter.patientSignature,
            signatureTimestamp: activeEncounter.signatureTimestamp,
            consentToTreatSignedAt: activeEncounter.consentToTreatSignedAt,
            hipaaAcknowledgedAt: activeEncounter.hipaaAcknowledgedAt,
          }}
          onClose={() => setShowDischarge(false)}
        />
      )}
    </div>
  );
}