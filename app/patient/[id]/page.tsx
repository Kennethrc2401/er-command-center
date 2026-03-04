"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { Id } from "@/convex/_generated/dataModel";

// UI Components
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { 
  Activity, Pill, History, Beaker, FileText, ClipboardCheck, Loader2, Printer, Scan, Home, AlertCircle,
  CheckCircle2,
  Clock,
  FileStack
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
import PatientTimeline from "@/components/PatientTimeline";
import { useState } from "react";
import CommandBar from "@/components/CommandBar";
import MedTimer from "@/components/MedTimer";
import LabTrends from "@/components/LabTrends";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import ShiftReport from "@/components/ShiftReport";
import SmartNotes from "@/components/notes/SmartNotes";
import EKGMonitor from "@/components/Monitors/EKGMonitor";

// DYNAMIC IMPORT: DischargeSummary
const DischargeSummary = dynamic(
  () => import("@/components/DischargeSummary"),
  { 
    ssr: false,
    loading: () => (
      <div className="h-64 flex items-center justify-center border-2 border-dashed rounded-xl bg-slate-50">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
          <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">
            Finalizing Discharge Module...
          </p>
        </div>
      </div>
    )
  }
);

export default function PatientPage() {
  const params = useParams();
  const patientId = params.id as Id<"patients">;

  const [activeTab, setActiveTab] = useState("vitals");
  const [currentTime] = useState(() => Date.now());

  // --- 1. CONVEX SUBSCRIPTIONS ---
  const patient = useQuery(api.patients.getById, { patientId });
  const encounters = useQuery(api.encounters.getByPatient, { patientId });
  
  // Find the active encounter safely
  const activeEncounter = encounters?.find(e => e.status !== "discharged") || encounters?.[0];
  
  // Clinical Safety Subscriptions
  const criticalLabs = useQuery(api.labs.getCriticalAlerts, 
    activeEncounter ? { encounterId: activeEncounter._id } : "skip"
  );

  const gcsScore = useQuery(
    api.triage.getLatestGCS, 
    activeEncounter ? { encounterId: activeEncounter._id } : "skip"
  );
// const pendingImagingCount = useQuery(api.imaging.getPendingCount, 
//   activeEncounter ? { encounterId: activeEncounter._id } : "skip"
// ) ?? 0;

  // Pending Task Counts for Tab Badges
  // Note: These assume you have these specific queries in your API
  const pendingLabsCount = useQuery(api.labs.getPendingCount, 
    activeEncounter ? { encounterId: activeEncounter._id } : "skip"
  ) ?? 0;

  // --- 2. EARLY RETURNS (LOADING & ERROR STATES) ---
  if (!patient || !encounters) {
    return (
      <div className="flex h-screen flex-col items-center justify-center space-y-4 bg-slate-50">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
        <p className="text-slate-500 font-black uppercase text-[10px] tracking-[0.3em]">
          Accessing Encrypted Records
        </p>
      </div>
    );
  }

  if (encounters.length === 0 || !activeEncounter) {
    return (
      <div className="flex h-screen flex-col items-center justify-center space-y-4 bg-white">
        <div className="bg-slate-100 p-6 rounded-full">
          <History className="h-10 w-10 text-slate-400" />
        </div>
        <h2 className="text-xl font-black text-slate-800">No Active Encounter</h2>
        <p className="text-slate-500 text-sm font-medium max-w-xs text-center">
          This patient is not currently checked into the ER. Please initiate a new encounter to begin charting.
        </p>
        <Button onClick={() => window.history.back()} variant="outline" className="rounded-xl font-bold">
          Return to Patient List
        </Button>
      </div>
    );
  }

  // --- 3. CLINICAL LOGIC & CALCULATIONS ---
  const currentEncounter = activeEncounter; 
  const latestVitals = currentEncounter?.vitals;

  const getSystolic = (bpString: string | undefined) => {
    if (!bpString) return 0;
    const systolic = parseInt(bpString.split("/")[0]);
    return isNaN(systolic) ? 0 : systolic;
  };

  const sbp = getSystolic(latestVitals?.bp);
  const isUnstable = latestVitals && (
    latestVitals.hr > 100 || 
    (latestVitals.spO2 < 94 && latestVitals.spO2 > 0) || 
    sbp > 160 || 
    (sbp < 90 && sbp > 0)
  );

  const getInstabilityReason = () => {
    if (!latestVitals) return "";
    if (latestVitals.hr > 100) return "Tachycardia";
    if (latestVitals.spO2 < 94 && latestVitals.spO2 > 0) return "Hypoxia";
    if (sbp > 160) return "Hypertension";
    if (sbp < 90 && sbp > 0) return "Hypotension";
    return "Critical Vitals";
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
      
      {/* CRITICAL ALERTS BANNER */}
      {criticalLabs && criticalLabs.length > 0 && <CriticalLabBanner alerts={criticalLabs} />}

      {/* 4. CLINICAL HEADER */}
      <header className="bg-white p-6 rounded-[2.5rem] border shadow-sm flex flex-col md:flex-row justify-between gap-4 border-slate-100 relative overflow-hidden">
        {isUnstable && <div className="absolute top-0 left-0 w-full h-1 bg-red-500 animate-pulse" />}
        
        <div className="flex items-center gap-5">
          <div className="h-16 w-16 rounded-2xl bg-slate-900 flex items-center justify-center text-white font-black text-2xl shadow-xl shadow-slate-200">
            {patient.name.charAt(0)}
          </div>
          <div className="text-left">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-black tracking-tighter text-slate-900 uppercase">
                {patient.name}
              </h1>
              {isUnstable && (
                <Badge className="bg-red-600 text-white animate-bounce border-none px-2 py-0.5 text-[9px] font-black uppercase">
                  <AlertCircle className="h-3 w-3 mr-1" /> {getInstabilityReason()}
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-2 items-center mt-1">
              <span className="text-[10px] font-mono font-black text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                MRN: {patient.mrn}
              </span>
              <CodeStatusSelector 
                patientId={patientId} 
                currentStatus={patient.codeStatus || "Full Code"} 
              />
              <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 uppercase">
                DOB: {new Date(patient.dob).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex flex-col items-end gap-3">
          <div className="flex gap-2">
            {patient.allergies.length > 0 ? (
              patient.allergies.map(allergy => (
                <span key={allergy} className="px-3 py-1 bg-red-600 text-white text-[9px] font-black rounded-full animate-pulse tracking-widest uppercase shadow-lg shadow-red-200">
                  ⚠️ {allergy}
                </span>
              ))
            ) : (
              <span className="px-3 py-1 bg-emerald-50 text-emerald-600 border border-emerald-100 text-[9px] font-black rounded-full uppercase tracking-widest">
                No Known Drug Allergies
              </span>
            )}
          </div>
          <div className="flex gap-2">
             <OrderMedication 
                patientId={patientId} 
                encounterId={currentEncounter._id} 
                patientAllergies={patient.allergies} 
              />
              <DischargeButton encounterId={currentEncounter._id} />
          </div>
        </div>
      </header>

      {/* 5. CLINICAL WORKSPACE GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
        
        <div className="lg:col-span-3 space-y-6">
          <CommandBar setTab={setActiveTab} />
          <Tabs 
            defaultValue={activeTab}
            className="w-full"
            value={activeTab} 
            onValueChange={setActiveTab}
          >
            <TabsList className="flex flex-wrap md:flex-nowrap w-full h-auto gap-1.5 bg-slate-100/80 p-1.5 rounded-[2rem] border border-slate-200 overflow-x-auto scrollbar-hide">
              {[
                { value: "vitals", icon: Activity, label: "Vitals", badge: 0 },
                { value: "triage", icon: ClipboardCheck, label: "Triage", badge: 0 },
                { value: "labs", icon: Beaker, label: "Labs", badge: pendingLabsCount },
                { value: "imaging", icon: Scan, label: "Imaging", badge: 0 },
                { value: "mar", icon: Pill, label: "MAR", badge: 0 },
                { value: "notes", icon: FileText, label: "Notes", badge: 0 },
              ].map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="flex-1 min-w-25 md:min-w-0 py-3 rounded-[1.5rem] font-black text-[10px] uppercase tracking-wider data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-600 transition-all"
                >
                  <tab.icon className="size-3.5 mr-2 shrink-0" /> 
                  <span className="truncate">{tab.label}</span>
                  {tab.badge > 0 && (
                    <span className="ml-1.5 px-1.5 py-0.5 bg-blue-600 text-white text-[8px] rounded-full animate-pulse">
                      {tab.badge}
                    </span>
                  )}
                </TabsTrigger>
              ))}

              <TabsTrigger
                value="discharge"
                className="flex-1 min-w-25 md:min-w-0 py-3 rounded-[1.5rem] font-black text-[10px] uppercase tracking-wider data-[state=active]:bg-emerald-600 data-[state=active]:text-white transition-all"
              >
                <Home className="size-3.5 mr-2 shrink-0" /> 
                <span className="truncate">Discharge</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="vitals" className="space-y-6 animate-in fade-in-50 focus-visible:ring-0 pt-4">
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <div className="md:col-span-1"><VitalSignsForm encounterId={currentEncounter._id} /></div>
                 <div className="md:col-span-2"><VitalsTrend encounterId={currentEncounter._id} /></div>

                 {/* Smart Note Card */}
                {/* <SmartNotes encounterId={currentEncounter._id} /> */}
                <Card className="border-slate-200 shadow-sm rounded-[2.5rem] overflow-hidden bg-slate-50">
                  <div className="bg-slate-900 p-4 text-center">
                    <span className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400">AI-Powered Smart Notes</span>
                  </div>
                  <CardContent className="p-6">
                    <SmartNotes encounterId={currentEncounter._id} />
                  </CardContent>
                </Card>
               </div>
            </TabsContent>

            <TabsContent value="triage" className="animate-in slide-in-from-left-2 focus-visible:ring-0 pt-4">
              <TriageAssessment encounterId={currentEncounter._id} />
            </TabsContent>

            <TabsContent value="labs" className="animate-in fade-in-50 focus-visible:ring-0 pt-4">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                  {/* PRIMARY LAB LIST (2/3) */}
                  <div className="lg:col-span-2">
                    <LabResults encounterId={currentEncounter._id} />
                  </div>

                  {/* TREND ANALYSIS (1/3) */}
                  <div className="lg:col-span-1 space-y-6">
                    <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-6">Serial Lab Tracking</h4>
                      <LabTrends encounterId={currentEncounter._id} />
                    </div>
                  </div>
                </div>
              </TabsContent>

            {/* <TabsContent value="imaging" className="animate-in fade-in-50 focus-visible:ring-0 pt-4">
              <ImagingOrders encounterId={currentEncounter._id} />
            </TabsContent> */}

            <TabsContent value="imaging" className="animate-in fade-in-50 focus-visible:ring-0 pt-4">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                {/* Left 2/3: Order new imaging */}
                <div className="lg:col-span-1">
                  <ImagingOrders encounterId={currentEncounter._id} />
                </div>
                
                {/* Right 2/3: View existing results */}
                <div className="lg:col-span-2">
                  <ImagingResults encounterId={currentEncounter._id} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="mar" className="space-y-6 animate-in fade-in-50 focus-visible:ring-0 pt-4">
              <MedicationHistory encounterId={currentEncounter._id} />
              <MAR encounterId={currentEncounter._id} patientAllergies={patient.allergies} />
            </TabsContent>

            <TabsContent value="notes" className="animate-in fade-in-50 focus-visible:ring-0 pt-4">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                <div className="lg:col-span-2">
                  <ClinicalNotes encounterId={currentEncounter._id} />
                </div>
                <div className="lg:col-span-1">
                  <SBARHandoff 
                    patient={patient} 
                    encounter={currentEncounter}
                    gcs={gcsScore}
                    criticalLabs={criticalLabs || []}
                  />
                </div>

                {/* FLOATING HANDOFF BUTTON */}
                <Dialog>
                  <DialogTrigger asChild>
                    <button className="fixed bottom-8 right-8 h-16 w-16 bg-slate-900 text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-50 group">
                      <div className="absolute -top-12 right-0 bg-slate-800 text-white text-[9px] font-black uppercase px-3 py-1.5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap tracking-widest">
                        Prepare Handoff
                      </div>
                      <FileStack className="h-6 w-6" />
                    </button>
                  </DialogTrigger>
                  <DialogContent className="max-w-3xl bg-transparent border-none p-0 shadow-none">
                    <ShiftReport 
                      patient={{
                        name: patient.name,
                        mrn: patient.mrn,
                        dob: patient.dob,
                        codeStatus: patient.codeStatus || "Full Code",
                        allergies: patient.allergies
                      }}
                      encounter={{
                        chiefComplaint: currentEncounter.chiefComplaint,
                        acuity: currentEncounter.acuity,
                        location: currentEncounter.location,
                        vitals: {
                          hr: currentEncounter.vitals.hr,
                          bp: currentEncounter.vitals.bp,
                          spO2: currentEncounter.vitals.spO2
                        }
                      }}
                      medsDue={[
                        { name: "Morphine", dose: "4mg", time: "19:00" },
                        { name: "Zofran", dose: "4mg", time: "20:30" }
                      ]}
                      pendingTasks={pendingLabsCount} 
                    />
                  </DialogContent>
                </Dialog>
              </div>
            </TabsContent>

            <TabsContent value="discharge" className="mt-6 animate-in fade-in-50 duration-500 outline-none">
              <div className="flex justify-between items-center mb-6 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">Departure Protocol: Active</span>
                </div>
                <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-2 font-black text-[10px] uppercase h-9 border-slate-200 bg-white hover:bg-slate-50 rounded-xl">
                  <Printer className="h-3.5 w-3.5" /> Generate Patient Packet
                </Button>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
                <div className="xl:col-span-8 space-y-6">
                  <FollowUpCard 
                    appt={{
                      specialty: "Cardiology",
                      provider: "Dr. Amanda Ramirez",
                      date: "2026-03-05",
                      time: "02:30 PM",
                      address: "Hackensack Meridian Health Ctr",
                      instructions: "Fast 8 hours prior to lab work."
                    }} 
                  />
                  <Card className="border-slate-200 shadow-sm rounded-[2.5rem] overflow-hidden">
                    <div className="bg-slate-900 p-4 text-center">
                      <span className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400">Official Discharge Summary</span>
                    </div>
                    <DischargeSummary encounterId={currentEncounter._id} />
                  </Card>
                </div>

                <div className="xl:col-span-4 space-y-6 lg:sticky lg:top-8">
                  <EducationTracker encounterId={currentEncounter._id} />
                  <Card className="border-emerald-100 bg-emerald-50/30 rounded-[2.5rem] p-6">
                    <h4 className="text-[10px] font-black uppercase text-emerald-800 mb-4 flex items-center gap-2 tracking-widest">
                      <CheckCircle2 className="h-4 w-4" /> Final Safety Check
                    </h4>
                    <div className="space-y-3">
                      {["Vitals within discharge limits", "Prescriptions sent to pharmacy", "Next Appt Confirmed", "Stable for private transport"].map((item) => (
                        <label key={item} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-emerald-100/50 shadow-sm cursor-pointer hover:bg-emerald-50 transition-colors">
                          <input type="checkbox" className="rounded-md border-emerald-300 text-emerald-600 h-4 w-4" />
                          <span className="text-[11px] font-bold text-slate-700">{item}</span>
                        </label>
                      ))}
                    </div>
                  </Card>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* PERSISTENT CARE SIDEBAR (Right 25%) */}
        <aside className="lg:col-span-1 space-y-6 lg:sticky lg:top-8">
          {/* MEDICATION DUE WATCHLIST */}
          <Card className="border-slate-200 shadow-xl rounded-[2.5rem] overflow-hidden bg-white">
            <div className="p-5 border-b bg-slate-50/50 flex justify-between items-center">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                <Clock className="h-4 w-4" /> Meds Due
              </h4>
              <Badge variant="outline" className="text-[8px] font-black border-slate-200">Next 4H</Badge>
            </div>
            <CardContent className="p-4 space-y-3">
              {/* You would map over your active medications here */}
              <MedTimer med={{ name: "Morphine", dose: "4mg", route: "IVP", frequency: 240, lastAdministered: currentTime - 235 * 60000 }} />
              <MedTimer med={{ name: "Zofran", dose: "4mg", route: "IVP", frequency: 480, lastAdministered: currentTime - 485 * 60000 }} />
            </CardContent>
          </Card>

          {/* 1. CARE SIDEBAR (Medications/Allergies/Alerts) */}
          <PatientCareSidebar 
            patientId={patientId} 
            encounterId={currentEncounter._id} 
          />

          {/* 1.5. LIVE TELEMETRY */}
          <EKGMonitor 
            bpm={currentEncounter.vitals.hr} 
            isUnstable={currentEncounter.vitals.hr > 110 || currentEncounter.vitals.hr < 50} 
          />

          {/* 2. ER CONTEXT (Pinned High for Clinical Priority) */}
          <Card className="border-slate-200 shadow-xl rounded-[2.5rem] overflow-hidden bg-slate-900 text-white">
            <CardContent className="p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-700/50 pb-4">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">ER Context</span>
                <Badge className="bg-emerald-500/10 text-emerald-400 border-none uppercase text-[8px] font-black tracking-widest">Active</Badge>
              </div>

              <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50 flex items-center justify-between">
                <div className="text-left">
                  <Label className="text-[9px] font-black uppercase text-slate-500 block mb-1 tracking-widest">Neuro Status</Label>
                  <p className="text-xs font-bold text-slate-200 uppercase">
                    {gcsScore !== undefined ? (gcsScore === 15 ? "Intact" : "Altered") : "Pending"}
                  </p>
                </div>
                <div className="text-right">
                  <Label className="text-[9px] font-black uppercase text-slate-500 block mb-1 tracking-widest">GCS</Label>
                  <span className={`text-xl font-black ${gcsScore && gcsScore <= 8 ? "text-red-500 animate-pulse" : "text-emerald-400"}`}>
                    {gcsScore ?? "--"}
                  </span>
                </div>
              </div>
              
              <div>
                <Label className="text-[9px] font-black uppercase text-slate-500 block mb-2 tracking-widest text-left">Current CC</Label>
                <p className="text-sm font-bold italic text-slate-200 leading-relaxed border-l-2 border-blue-500 pl-3 text-left">
                  &quot;{currentEncounter.chiefComplaint}&quot;
                </p>
              </div>

              <div>
                <Label className="text-[9px] font-black uppercase text-slate-500 block mb-2 tracking-widest text-left">Triage Acuity</Label>
                <div className={`w-full py-3 rounded-2xl text-center text-xs font-black uppercase tracking-widest ${currentEncounter.acuity <= 2 ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'}`}>
                  ESI LEVEL {currentEncounter.acuity}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 3. VISIT TIMELINE (Scroll-Locked History) */}
          <Card className="border-slate-200 shadow-sm rounded-[2.5rem] overflow-hidden bg-white">
            <div className="p-5 border-b bg-slate-50/50">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                <History className="h-4 w-4" /> Visit Timeline
              </h4>
            </div>
            
            {/* Setting a max-height and custom scrollbar to keep layout stable */}
            <CardContent className="p-6 max-h-87.5 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
              <PatientTimeline encounterId={currentEncounter._id} />
              {/* Spacer to allow the last item to be fully visible */}
              <div className="h-4" />
            </CardContent>

            {/* Visual Fade effect to indicate more content below */}
            <div className="h-8 bg-linear-to-t from-white to-transparent -mt-8 pointer-events-none" />
          </Card>
        </aside>
      </div>
    </div>
  );
}