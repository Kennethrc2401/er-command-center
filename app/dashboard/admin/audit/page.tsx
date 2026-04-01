"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { 
  ShieldCheck, ShieldAlert, FileSearch, 
  UserCircle, Download, CheckCircle2, 
  Filter, Lock, Eye
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Encounter {
  _id: string;
  patientName: string;
  insurance?: {
    provider: string;
    policyNumber: string;
    status: "Verified" | string;
  };
}

export default function IdentityAuditLog() {
  const encounters = useQuery(api.encounters.getActive); // Ensure this returns insurance info
  const [isPrivacyMode, setIsPrivacyMode] = useState(false);

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-8 text-slate-900 animate-in fade-in duration-500 dark:text-slate-100">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-600 rounded-xl text-white">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h1 className="text-4xl font-black uppercase italic tracking-tighter text-slate-900 dark:text-slate-100">
              Identity <span className="text-emerald-600">Audit</span> Log
            </h1>
          </div>
          <p className="pl-14 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">
            Compliance Standard: FTC Red Flag Rule Section 114
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            onClick={() => setIsPrivacyMode(!isPrivacyMode)}
            className="gap-2 rounded-2xl border-slate-200 text-[10px] font-black uppercase dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            {isPrivacyMode ? <Eye className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
            {isPrivacyMode ? "Show PII" : "Privacy Mode"}
          </Button>
          <Button className="gap-2 rounded-2xl bg-slate-900 text-[10px] font-black uppercase dark:bg-slate-100 dark:text-slate-900">
            <Download className="h-4 w-4" /> Export Audit
          </Button>
        </div>
      </div>

      {/* AUDIT SUMMARY CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 bg-emerald-50 border-emerald-100 rounded-[2rem]">
          <p className="text-[9px] font-black text-emerald-700 uppercase tracking-widest mb-1">Total Audits Complete</p>
          <p className="text-3xl font-black text-emerald-900 italic">94%</p>
        </Card>
        <Card className="p-6 bg-amber-50 border-amber-100 rounded-[2rem]">
          <p className="text-[9px] font-black text-amber-700 uppercase tracking-widest mb-1">Discrepancies Flagged</p>
          <p className="text-3xl font-black text-amber-900 italic">02</p>
        </Card>
        <Card className="p-6 bg-blue-50 border-blue-100 rounded-[2rem]">
          <p className="text-[9px] font-black text-blue-700 uppercase tracking-widest mb-1">Pending Admissions</p>
          <p className="text-3xl font-black text-blue-900 italic">05</p>
        </Card>
      </div>

      {/* THE AUDIT TABLE */}
      <div className="overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-950/50">
          <div className="flex items-center gap-4">
             <Filter className="h-4 w-4 text-slate-400" />
             <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-300">Active Unit Census</span>
          </div>
          <Badge variant="outline" className="bg-white text-[9px] font-black dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">Unit 4B - Hackensack</Badge>
        </div>

        <Table>
          <TableHeader className="bg-slate-50/50 dark:bg-slate-950/50">
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-[9px] font-black uppercase tracking-widest">Patient / MRN</TableHead>
              <TableHead className="text-[9px] font-black uppercase tracking-widest">Payer Documentation</TableHead>
              <TableHead className="text-[9px] font-black uppercase tracking-widest">Legal ID Scan</TableHead>
              <TableHead className="text-[9px] font-black uppercase tracking-widest">Audit Status</TableHead>
              <TableHead className="text-right text-[9px] font-black uppercase tracking-widest">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(encounters as Encounter[] | undefined)?.map((enc: Encounter) => (
                <TableRow key={enc._id} className="group transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <TableCell>
                        <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
                                <UserCircle className="h-6 w-6 text-slate-400" />
                            </div>
                            <div>
                                <p className={`text-sm font-bold uppercase ${isPrivacyMode ? 'blur-sm select-none' : ''}`}>
                                    {enc.patientName}
                                </p>
                        <p className="text-[9px] font-mono text-slate-400 dark:text-slate-500">MRN-9283-4</p>
                            </div>
                        </div>
                    </TableCell>
                    <TableCell>
                    <p className="text-[10px] font-bold uppercase italic text-slate-600 dark:text-slate-300">
                            {enc.insurance?.provider || "Self-Pay"}
                        </p>
                    <p className="text-[9px] font-mono text-slate-400 dark:text-slate-500">ID: {enc.insurance?.policyNumber || "---"}</p>
                    </TableCell>
                    <TableCell>
                        {enc.insurance?.status === "Verified" ? (
                            <div className="flex items-center gap-2 text-emerald-600">
                                <CheckCircle2 className="h-4 w-4" />
                                <span className="text-[10px] font-black uppercase tracking-tighter">Verified</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 text-amber-500">
                                <ShieldAlert className="h-4 w-4" />
                                <span className="text-[10px] font-black uppercase tracking-tighter">Missing Scan</span>
                            </div>
                        )}
                    </TableCell>
                    <TableCell>
                        <Badge className={`${enc.insurance?.status === "Verified" ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300'} border-none text-[8px] font-black uppercase tracking-widest`}>
                            {enc.insurance?.status === "Verified" ? "COMPLIANT" : "FLAGGED"}
                        </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                        <Button variant="ghost" size="sm" className="h-8 w-8 rounded-xl border p-0 hover:border-slate-200 hover:bg-white dark:border-slate-700 dark:hover:bg-slate-800">
                            <FileSearch className="h-4 w-4 text-slate-400" />
                        </Button>
                    </TableCell>
                </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function Card({ children, className }: { children: React.ReactNode, className?: string }) {
  return <div className={`shadow-sm ${className}`}>{children}</div>;
}