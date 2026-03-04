"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ClerkLoading, SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { 
  Activity, Search, Clock, ArrowUpRight, ChevronDown, 
  BedDouble, Trash2, Lock, Monitor
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

// UI Components
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

// Custom Dashboard Components
import NewPatientModal from "@/components/NewPatientModal";
import ShiftSummary from "@/components/ShiftSummary";
import TriageStats from "@/components/TriageStats";
import TriageSummaryCard from "@/components/TriageSummaryCard";

export default function Page() {
  return (
    <>
      <ClerkLoading>
        <div className="flex h-[80vh] items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </ClerkLoading>

      <SignedIn>
        <ERDashboardContent />
      </SignedIn>

      <SignedOut>
        <div className="flex flex-col items-center justify-center h-[80vh] space-y-6 text-center p-6 text-slate-900 bg-white">
          <div className="bg-slate-100 p-6 rounded-full text-slate-400">
            <Lock className="h-12 w-12" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-black tracking-tighter uppercase">Clinical Access Restricted</h1>
            <p className="text-slate-500 max-w-sm mx-auto font-medium">
              This system contains Protected Health Information (PHI). Please sign in with your Staff Credentials to access the Unit 4B Command Center.
            </p>
          </div>
          <SignInButton mode="modal">
            <button className="bg-blue-600 text-white px-10 py-4 rounded-2xl font-black uppercase text-xs tracking-[0.2em] hover:bg-blue-700 transition-all shadow-2xl shadow-blue-100">
              Provider Secure Login
            </button>
          </SignInButton>
        </div>
      </SignedOut>
    </>
  );
}

function ERDashboardContent() {
  const [searchTerm, setSearchTerm] = useState(""); 
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  // Convex Subscriptions
  const activeEncounters = useQuery(api.encounters.getActive);
  const updateStatus = useMutation(api.encounters.updateStatus);
  const assignBed = useMutation(api.encounters.assignBed);
  const clearBeds = useMutation(api.encounters.clearAllBeds);
  
  // Census Logic
  const totalBeds = 20;
  const occupiedBeds = activeEncounters?.filter(e => e.location && e.location.startsWith("Bed")).length ?? 0;
  const availableBeds = totalBeds - occupiedBeds;

  // Real-time Clock Sync for wait times
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);

  // Find most critical patient for the TriageSummaryCard
  const criticalPatient = useMemo(() => {
    if (!activeEncounters) return undefined;
    return activeEncounters
      .filter(e => e.acuity <= 2 && e.status !== "discharged")
      .sort((a, b) => a.acuity - b.acuity || b._creationTime - a._creationTime)[0];
  }, [activeEncounters]);

  // Vitals Alert Logic
  useEffect(() => {
    const spikedPatients = activeEncounters?.filter(
      e => e.vitals.previousHr && e.vitals.hr >= e.vitals.previousHr * 1.2
    );

    if (spikedPatients && spikedPatients.length > 0) {
      spikedPatients.forEach(p => {
        toast.error(`Critical Alert: ${p.patientName}`, {
          description: `Significant HR spike detected in ${p.location || 'Triage'}.`,
          duration: 10000,
        });
      });
    }
  }, [activeEncounters]);

  // Filtering Logic
  const filteredEncounters = activeEncounters?.filter((e) => {
    const matchesSearch = searchTerm === "" || 
      e.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.mrn.toLowerCase().includes(searchTerm.toLowerCase());

    let matchesMetric = true;
    if (activeFilter === "Critical") matchesMetric = e.acuity === 1;
    if (activeFilter === "Bottle-Neck") matchesMetric = (currentTime - e._creationTime) > 3600000;
    
    return matchesSearch && matchesMetric;
  });

  return (
    <main className="min-h-screen bg-slate-50/50 p-4 md:p-10 pt-24 md:pt-28">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">System Telemetry Live</span>
            </div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase leading-none">Command Center</h1>
            <p className="text-slate-500 font-bold text-xs uppercase tracking-tight mt-1">Hackensack Meridian | 4B-ER | Unit Census</p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            <Link href="/dashboard/monitor">
              <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-900 hover:text-white transition-all h-12 shadow-sm">
                <Monitor className="h-4 w-4" /> Monitor View
              </button>
            </Link>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="Find Patient or MRN..." 
                className="pl-9 bg-white border-slate-200 h-12 shadow-sm rounded-2xl focus:ring-blue-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <NewPatientModal />
          </div>
        </div>

        {/* HIGH ACUITY SUMMARY (ESI 1/2) */}
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

        {/* CENSUS STATS */}
        <section className="space-y-6">
          <ShiftSummary onFilterChange={setActiveFilter} activeFilter={activeFilter} />
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-4">
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none">Bed Capacity</p>
                  <p className="text-xs font-bold text-slate-600 mt-1">{occupiedBeds} of {totalBeds} Units Full</p>
                </div>
                <span className={`text-xl font-black ${(occupiedBeds / totalBeds) > 0.8 ? 'text-red-600' : 'text-blue-600'}`}>
                  {Math.round((occupiedBeds / totalBeds) * 100)}%
                </span>
              </div>
              <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200 shadow-inner">
                <div 
                  className={`h-full transition-all duration-1000 ${
                    (occupiedBeds / totalBeds) > 0.9 ? 'bg-red-600' : (occupiedBeds / totalBeds) > 0.7 ? 'bg-orange-500' : 'bg-blue-600'
                  }`}
                  style={{ width: `${(occupiedBeds / totalBeds) * 100}%` }}
                />
              </div>
            </div>

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

        {/* FLOOR PLAN MATRIX */}
        <section className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-200/50">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2">
              <BedDouble className="h-5 w-5 text-blue-600" />
              <h2 className="font-black text-slate-800 uppercase text-xs tracking-[0.2em]">Real-Time Bed Matrix</h2>
            </div>
            <button onClick={() => confirm("Reset all Bed Assignments?") && clearBeds()} className="text-[10px] font-black text-red-500 hover:text-red-700 uppercase flex items-center gap-2 transition-all p-2 hover:bg-red-50 rounded-xl">
              <Trash2 className="h-4 w-4" /> Purge Matrix
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
                    const name = prompt(`Assign patient name to ${bedId}:`);
                    const p = activeEncounters?.find(e => e.patientName.toLowerCase().includes(name?.toLowerCase() || ""));
                    if (p) assignBed({ encounterId: p._id, location: bedId });
                  }
                }} className={`relative h-28 rounded-2xl border-2 transition-all cursor-pointer flex flex-col items-center justify-center p-3 ${
                  occupant ? "border-blue-600 bg-blue-50/30 shadow-md ring-4 ring-blue-500/5" : "border-dashed border-slate-200 hover:border-blue-300 hover:bg-blue-50/20"
                }`}>
                  <span className="absolute top-2 left-3 text-[9px] font-black text-slate-400 uppercase tracking-tighter">{bedId}</span>
                  {occupant ? (
                    <div className="flex flex-col items-center gap-2 text-center">
                      <div className="text-[10px] font-black text-blue-950 leading-tight uppercase truncate w-full">{occupant.patientName.split(' ')[0]}</div>
                      <Badge className={`text-[8px] font-black h-4 px-1.5 border-none ${occupant.acuity === 1 ? 'bg-red-600 animate-pulse text-white' : 'bg-blue-600 text-white'}`}>ESI {occupant.acuity}</Badge>
                    </div>
                  ) : <div className="w-2 h-2 rounded-full bg-slate-200" />}
                </div>
              );
            })}
          </div>
        </section>

        {/* ACTIVE TRIAGE QUEUE */}
        <Card className="shadow-2xl border-none rounded-[3rem] overflow-hidden bg-white ring-1 ring-slate-200">
          <CardHeader className="bg-white border-b py-6 px-8">
            <div className="flex justify-between items-center">
              <CardTitle className="text-xl font-black flex items-center gap-3 text-slate-900 uppercase tracking-tight leading-none">
                <Activity className="h-5 w-5 text-blue-600" /> Active Census
              </CardTitle>
              <Badge variant="outline" className="bg-slate-50 text-slate-500 font-black border-slate-200 px-4 py-1.5 uppercase text-[10px] tracking-widest">
                {filteredEncounters?.length ?? 0} Clinical Encounters
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-slate-50/50 border-b">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-24 text-center font-black text-slate-400 text-[10px] uppercase">ESI</TableHead>
                  <TableHead className="font-black text-slate-400 text-[10px] uppercase">Identity</TableHead>
                  <TableHead className="font-black text-slate-400 text-[10px] uppercase">Wait/Tasks</TableHead>
                  <TableHead className="font-black text-slate-400 text-[10px] uppercase">Live Vitals</TableHead>
                  <TableHead className="font-black text-slate-400 text-[10px] uppercase">Phase</TableHead>
                  <TableHead className="text-right pr-8 font-black text-slate-400 text-[10px] uppercase">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEncounters?.map((e) => {
                  const waitTime = Math.floor((currentTime - e._creationTime) / 60000);
                  const isCriticalVitals = (e.vitals.spO2 < 92 && e.vitals.spO2 > 0) || e.vitals.hr > 120;
                  const isHrSpiked = e.vitals.previousHr && e.vitals.hr >= e.vitals.previousHr * 1.2;

                  return (
                    <TableRow key={e._id} className={`h-24 transition-all group ${
                      e.acuity === 1 || isCriticalVitals ? "bg-red-50/40 hover:bg-red-50 border-l-12 border-l-red-600" : "hover:bg-slate-50/50 border-l-12 border-l-transparent"
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
                        <div className="font-black text-slate-900 text-base leading-none mb-1.5 uppercase tracking-tighter">{e.patientName}</div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-slate-400 font-mono tracking-tighter">MRN: {e.mrn}</span>
                          <button onClick={() => {
                            const b = prompt(`Set Bed/Location:`, e.location || "");
                            if (b !== null) assignBed({ encounterId: e._id, location: b });
                          }} className="text-[8px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100 hover:bg-blue-600 hover:text-white transition-all uppercase">
                            {e.location || "+ Assign Bed"}
                          </button>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="space-y-2">
                          <div className={`flex items-center gap-1.5 text-xs font-black ${waitTime > 60 ? 'text-red-600' : 'text-slate-600'}`}>
                            <Clock className="h-3.5 w-3.5" /> {waitTime}m
                          </div>
                          <div className="flex gap-1.5">
                            <div className="h-1.5 w-6 rounded-full bg-blue-500" title="Labs Pending" />
                            <div className="h-1.5 w-6 rounded-full bg-slate-200" title="Imaging Status" />
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                          <VitalLabel label="HR" value={e.vitals.hr} alert={e.vitals.hr > 110} trend={isHrSpiked ? 'up' : 'stable'} />
                          <VitalLabel label="BP" value={e.vitals.bp || "---/--"} />
                          <VitalLabel label="O2" value={e.vitals.spO2} alert={e.vitals.spO2 < 93} suffix="%" />
                          <VitalLabel label="T" value={e.vitals.temp} alert={e.vitals.temp > 100.4} suffix="°" />
                        </div>
                      </TableCell>

                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-900 hover:text-white transition-all group/btn">
                              <span className="text-[10px] font-black uppercase tracking-widest">{e.status}</span>
                              <ChevronDown className="h-3.5 w-3.5 text-slate-400 group-hover/btn:text-white" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="rounded-2xl p-2 shadow-2xl border-slate-200 w-44">
                            {(["triage", "waiting", "treating", "observed", "discharged"] as const).map((status) => (
                              <DropdownMenuItem key={status} className="capitalize font-bold text-xs cursor-pointer rounded-xl py-2.5" onClick={() => updateStatus({ encounterId: e._id, nextStatus: status })}>
                                {status}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>

                      <TableCell className="text-right pr-8">
                        <Link href={`/patient/${e.patientId}`}>
                          <button className="inline-flex items-center gap-2 px-6 py-3.5 rounded-3xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-xl active:scale-95">
                            Enter Chart <ArrowUpRight className="h-4 w-4 text-blue-400" />
                          </button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function VitalLabel({ label, value, alert, trend, suffix = "" }: { label: string; value: string | number | null | undefined; alert?: boolean; trend?: "up" | "stable"; suffix?: string; }) {
  if (!value) return <span className="text-[10px] font-bold text-slate-300 uppercase tracking-tighter">{label}: --</span>;
  return (
    <div className={`text-[10px] font-bold flex items-center gap-1.5 uppercase ${alert ? "text-red-600 font-black" : "text-slate-600"}`}>
      {label}: {value}{suffix}
      {trend === "up" && <ArrowUpRight className="h-3 w-3 text-red-500 animate-bounce" />}
      {alert && <div className="h-1.5 w-1.5 rounded-full bg-red-600 animate-ping" />}
    </div>
  );
}