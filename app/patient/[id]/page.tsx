"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { Doc, Id } from "@/convex/_generated/dataModel";

// UI Components
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { 
  Activity, Pill, History, Beaker, FileText, ClipboardCheck, Loader2, Printer, Scan, Home, AlertCircle,
  FileStack,
  ShieldCheck,
  Download,
  Info,
  Search
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
import InsuranceBadge from "@/components/insurance/InsuranceBadge";
import VirtualInsuranceCard from "@/components/insurance/finances/VirtualInsuranceCard";
import InsuranceFinancials from "@/components/insurance/InsuranceFinancials";
import InsuranceCardModal from "@/components/insurance/InsuranceCardModal";
import IdentityVerificationModal from "@/components/insurance/identification/IdentityVerificationModal";
import { toast } from "sonner";

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

interface DetailedEncounter extends Omit<Doc<"encounters">, "insurance"> {
  insurance?: Doc<"insurance">;
  estimatedDischargeTime?: number;
}

export default function PatientPage() {
  const params = useParams();
  const patientId = params.id as Id<"patients">;
  const runDiscovery = useMutation(api.insurance.discoverSecondaryCoverage);
  const [isSearching, setIsSearching] = useState(false);
  const [activeTab, setActiveTab] = useState("vitals");
  const [currentTime] = useState(() => Date.now());
  const [isPresentationMode, setIsPresentationMode] = useState(false);

  // --- 2. CONVEX SUBSCRIPTIONS ---
  const patient = useQuery(api.patients.getById, { patientId });
  
  // Use the new JOINED query we discussed
  const encounters = useQuery(api.encounters.getByPatientWithInsurance, { patientId });
  
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

  // --- 3. LOADING & ERROR STATES ---
  if (!patient || !encounters) {
    return (
      <div className="flex h-screen flex-col items-center justify-center space-y-4 bg-slate-50">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
        <p className="text-slate-500 font-black uppercase text-[10px] tracking-[0.3em]">Accessing Encrypted Records</p>
      </div>
    );
  }

  if (encounters.length === 0 || !activeEncounter) {
    return (
      <div className="flex h-screen flex-col items-center justify-center space-y-4 bg-white">
        <History className="h-10 w-10 text-slate-400" />
        <h2 className="text-xl font-black text-slate-800 uppercase italic">No Active Encounter</h2>
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
        } catch (err) {
          setIsSearching(false);
          toast.error("System Error", { description: "HIE interface failure." });
        }
      };
      
  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6 bg-slate-50/30">
      
      {criticalLabs && criticalLabs.length > 0 && <CriticalLabBanner alerts={criticalLabs} />}

      {/* HEADER */}
      <header className="bg-white p-6 rounded-[2.5rem] border shadow-sm flex flex-col md:flex-row justify-between gap-4 border-slate-100 relative overflow-hidden">
        {isUnstable && <div className="absolute top-0 left-0 w-full h-1 bg-red-500 animate-pulse" />}
        
        <div className="flex items-center gap-5">
          <div className="h-16 w-16 rounded-2xl bg-slate-900 flex items-center justify-center text-white font-black text-2xl shadow-xl shadow-slate-200 uppercase italic">
            {patient.name.charAt(0)}
          </div>
          <div className="text-left">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-black tracking-tighter text-slate-900 uppercase italic">
                {patient.name}
              </h1>
              {isUnstable && (
                <Badge className="bg-red-600 text-white animate-bounce border-none px-2 py-1 text-[9px] font-black uppercase tracking-widest">
                  <AlertCircle className="h-3 w-3 mr-1" /> {getInstabilityReason()}
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-2 items-center mt-1">
              <span className="text-[10px] font-mono font-black text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-100 tracking-tighter">
                MRN: {patient.mrn}
              </span>
              <CodeStatusSelector patientId={patientId} currentStatus={patient.codeStatus || "Full Code"} />
              <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 uppercase italic">
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
              <span className="px-3 py-1 bg-emerald-50 text-emerald-600 border border-emerald-100 text-[9px] font-black rounded-full uppercase tracking-widest italic">
                NKDA
              </span>
            )}
          </div>
          <div className="flex gap-2">
             <OrderMedication patientId={patientId} encounterId={activeEncounter._id} patientAllergies={patient.allergies} />
             <DischargeButton encounterId={activeEncounter._id} />
          </div>
        </div>
      </header>

      {/* WORKSPACE GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
        {/* PRESENTATION MODE TOGGLE */}
        <div className="flex justify-end mb-4">
          <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-2xl border border-slate-100 shadow-sm">
            <span className={`text-[9px] font-black uppercase tracking-widest ${isPresentationMode ? 'text-blue-600' : 'text-slate-400'}`}>
              {isPresentationMode ? "Presentation Mode: ON" : "Normal Mode"}
            </span>
            <button 
              onClick={() => setIsPresentationMode(!isPresentationMode)}
              className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${isPresentationMode ? 'bg-blue-600' : 'bg-slate-200'}`}
            >
              <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform duration-300 ${isPresentationMode ? 'translate-x-6' : 'translate-x-0'}`} />
            </button>
          </div>
        </div>
        <div className="lg:col-span-3 space-y-6">
          <CommandBar setTab={setActiveTab} />
          
          <Tabs defaultValue={activeTab} value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="flex flex-wrap md:flex-nowrap w-full h-auto gap-1.5 bg-slate-100/80 p-1.5 rounded-[2rem] border border-slate-200 overflow-x-auto">
              {[
                { value: "vitals", icon: Activity, label: "Vitals", badge: 0 },
                { value: "triage", icon: ClipboardCheck, label: "Triage", badge: 0 },
                { value: "labs", icon: Beaker, label: "Labs", badge: pendingLabsCount },
                { value: "imaging", icon: Scan, label: "Imaging", badge: 0 },
                { value: "mar", icon: Pill, label: "MAR", badge: 0 },
                { value: "notes", icon: FileText, label: "Notes", badge: 0 },
                { value: "billing", icon: FileStack, label: "Billing", badge: 0 },
                { value: "discharge", icon: Home, label: "Discharge", badge: 0 },
              ].map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="flex-1 min-w-25 md:min-w-0 py-3 rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-600 transition-all italic"
                >
                  <tab.icon className="size-3.5 mr-2 shrink-0" /> 
                  <span className="truncate">{tab.label}</span>
                  {tab.badge > 0 && (
                    <span className="ml-1.5 px-1.5 py-0.5 bg-blue-600 text-white text-[8px] rounded-full animate-pulse">{tab.badge}</span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* VITALS & ADMINISTRATIVE TAB */}
           <TabsContent value="vitals" className="space-y-6 animate-in fade-in-50 pt-4 outline-none">
            {/* TOP ROW: CLINICAL CORE */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-1">
                <VitalSignsForm encounterId={activeEncounter._id} />
              </div>
              <div className="xl:col-span-2">
                <VitalsTrend encounterId={activeEncounter._id} />
              </div>
            </div>

            {/* MIDDLE ROW: ADMINISTRATIVE SUITE (Cleaned & Responsive) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* LEFT: Eligibility & Identity Audit (7 Cols) */}
              <div className="lg:col-span-7 space-y-4">
                <div className="flex items-center gap-2 px-2">
                  <div className="h-1 w-6 bg-blue-500 rounded-full" />
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 italic">Insurance & Eligibility Audit</h3>
                </div>
                
                <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-4">
                  <InsuranceBadge 
                    encounterId={activeEncounter._id} 
                    insurance={activeEncounter.insurance} 
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {activeEncounter.insurance && (
                      <IdentityVerificationModal 
                        patient={patient} 
                        insurance={activeEncounter.insurance} 
                      />
                    )}
                    
                    <button 
                      onClick={handleDiscovery}
                      disabled={isSearching}
                      className="flex items-center justify-center gap-3 py-4 bg-slate-50 text-slate-500 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all border border-slate-200 disabled:opacity-50"
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
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 italic">Financial Counseling</h3>
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
            <Card className="border-slate-200 shadow-sm rounded-[2.5rem] overflow-hidden bg-slate-50/50">
              <div className="bg-slate-900 px-8 py-4 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                  <span className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 italic">AI Clinical Scribe v2.0</span>
                </div>
                <Badge className="bg-white/10 text-slate-400 border-none text-[8px] font-black tracking-widest uppercase py-0.5">Real-Time Sync</Badge>
              </div>
              <CardContent className="p-6">
                <SmartNotes encounterId={activeEncounter._id} />
              </CardContent>
            </Card>
          </TabsContent> 

            <TabsContent value="triage" className="pt-4"><TriageAssessment encounterId={activeEncounter._id} /></TabsContent>
            <TabsContent value="labs" className="pt-4">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2"><LabResults encounterId={activeEncounter._id} /></div>
                <div className="lg:col-span-1"><LabTrends encounterId={activeEncounter._id} /></div>
              </div>
            </TabsContent>
            <TabsContent value="imaging" className="pt-4">
               <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-1"><ImagingOrders encounterId={activeEncounter._id} /></div>
                  <div className="lg:col-span-2"><ImagingResults encounterId={activeEncounter._id} /></div>
               </div>
            </TabsContent>
            <TabsContent value="mar" className="pt-4 space-y-6">
               <MedicationHistory encounterId={activeEncounter._id} />
               <MAR encounterId={activeEncounter._id} patientAllergies={patient.allergies} />
            </TabsContent>
            <TabsContent value="notes" className="pt-4">
               <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2"><ClinicalNotes encounterId={activeEncounter._id} /></div>
                  <div className="lg:col-span-1"><SBARHandoff patient={patient} encounter={activeEncounter} gcs={gcsScore} criticalLabs={criticalLabs || []} /></div>
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
                          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 italic">Document Imaging</h3>
                          <Badge variant="outline" className="text-[8px] font-black border-slate-200">SCAN_REF: 992834</Badge>
                        </div>
                        <VirtualInsuranceCard 
                          insurance={activeEncounter.insurance} 
                          patientName={patient.name} 
                        />
                      </div>
                    )}

                    {/* 2. Detailed Eligibility Response */}
                    <Card className="border-slate-200 shadow-sm rounded-[2.5rem] overflow-hidden bg-white">
                      <div className="bg-slate-900 p-4 flex justify-between items-center">
                        <span className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400">EDI 271 Transaction Detail</span>
                        <span className="text-[9px] font-mono text-slate-500 uppercase">Gateway: Availity v5.1</span>
                      </div>
                      <CardContent className="p-8">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
                          <div className="space-y-1">
                            <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Plan Type</Label>
                            <p className="text-sm font-bold text-slate-900">Commercial PPO</p>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Effective Date</Label>
                            <p className="text-sm font-bold text-slate-900">01/01/2026</p>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Coordination of Benefits</Label>
                            <p className="text-sm font-bold text-blue-600">Primary</p>
                          </div>
                        </div>

                        <div className="mt-8 pt-8 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div className="space-y-4">
                            <div className="flex items-center gap-2">
                              <ShieldCheck className="h-4 w-4 text-emerald-500" />
                              <span className="text-xs font-black uppercase tracking-widest text-slate-800">Prior Auth Required</span>
                            </div>
                            <p className="text-xs text-slate-500 leading-relaxed">
                              Prior authorization is <span className="font-bold text-slate-900 underline">REQUIRED</span> for advanced imaging (CT/MRI) and inpatient stays exceeding 23 hours.
                            </p>
                          </div>
                          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
                            <div>
                              <p className="text-[9px] font-black uppercase text-slate-400">Auth Case ID</p>
                              <p className="text-sm font-mono font-bold text-slate-900">AUTH-PEND-772</p>
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
                    <Card className="border-amber-100 bg-amber-50/30 rounded-[2.5rem] p-6">
                      <h4 className="text-[10px] font-black uppercase text-amber-800 mb-4 flex items-center gap-2 tracking-widest italic">
                        <Info className="h-4 w-4" /> Registrar&apos;s Note
                      </h4>
                      <textarea 
                        placeholder="Log insurance-related discussions or secondary coverage info..."
                        className="w-full h-32 bg-white/50 border border-amber-200 rounded-2xl p-4 text-xs font-medium focus:ring-2 focus:ring-amber-400 outline-none transition-all placeholder:text-amber-200"
                      />
                      <Button className="w-full mt-4 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-black text-[10px] uppercase tracking-widest italic shadow-lg shadow-amber-200/50">
                        Save Admin Note
                      </Button>
                    </Card>

                    {/* 5. Quick Actions */}
                    <div className="grid grid-cols-1 gap-3">
                      <Button variant="outline" className="rounded-2xl py-6 font-black text-[10px] uppercase tracking-widest border-slate-200 group">
                        <Download className="h-4 w-4 mr-2 group-hover:translate-y-0.5 transition-transform" /> Download Face Sheet
                      </Button>
                      <Button variant="outline" className="rounded-2xl py-6 font-black text-[10px] uppercase tracking-widest border-slate-200 group">
                        <Printer className="h-4 w-4 mr-2 group-hover:-translate-y-0.5 transition-transform" /> Print ID Stickers
                      </Button>
                    </div>
                  </div>
                </div>
              </TabsContent>

            <TabsContent value="discharge" className="pt-4 space-y-6">
               <div className="flex justify-between items-center bg-slate-100/50 p-4 rounded-3xl border border-slate-200">
                  <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest italic flex items-center gap-2">
                     <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> Final Safety Handoff
                  </span>
                  <Button variant="outline" size="sm" className="font-black text-[10px] uppercase rounded-xl"><Printer className="h-3.5 w-3.5 mr-2" /> Print Summary</Button>
               </div>
               <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                  <div className="xl:col-span-8 space-y-6"><FollowUpCard appt={{ followUpDate: activeEncounter.estimatedDischargeTime ? new Date(activeEncounter.estimatedDischargeTime).toISOString().split('T')[0] : undefined, provider: "", specialty: "", time: "", address: "" }} /><DischargeSummary encounterId={activeEncounter._id} /></div>
                  <div className="xl:col-span-4"><EducationTracker encounterId={activeEncounter._id} /></div>
               </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* SIDEBAR */}
        <aside className="lg:col-span-1 space-y-6 lg:sticky lg:top-8">
          <EKGMonitor bpm={activeEncounter.vitals.hr} isUnstable={isUnstable} />
          
          <Card className="border-slate-200 shadow-xl rounded-[2.5rem] overflow-hidden bg-slate-900 text-white">
            <CardContent className="p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-700/50 pb-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">ER Context</span>
                <Badge className="bg-emerald-500 text-white border-none text-[8px] font-black">ACTIVE</Badge>
              </div>
              <div className="flex justify-between">
                 <div><Label className="text-[9px] font-black uppercase text-slate-500 block">GCS</Label><span className="text-xl font-black">{gcsScore ?? "15"}</span></div>
                 <div className="text-right"><Label className="text-[9px] font-black uppercase text-slate-500 block">ESI</Label><span className="text-xl font-black text-blue-400">{activeEncounter.acuity}</span></div>
              </div>
              <div>
                <Label className="text-[9px] font-black uppercase text-slate-500 block mb-1">Chief Complaint</Label>
                <p className="text-sm font-bold italic text-slate-200 border-l-2 border-blue-500 pl-3">&quot;{activeEncounter.chiefComplaint}&quot;</p>
              </div>
            </CardContent>
          </Card>
          
          <PatientCareSidebar patientId={patientId} encounterId={activeEncounter._id} />
          <PatientTimeline encounterId={activeEncounter._id} />
        </aside>
      </div>
    </div>
  );
}