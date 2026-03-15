"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ShieldCheck, ShieldAlert, Loader2, Search, CreditCard } from "lucide-react";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";

// Define the shape of the insurance prop based on your new schema
interface InsuranceData {
  _id: string;
  provider: string;
  policyNumber: string;
  status: "pending" | "verified" | "denied";
  lastVerified?: number;
}

export default function InsuranceBadge({ 
    encounterId, 
    insurance 
  }: { 
    encounterId: Id<"encounters">, 
    insurance?: InsuranceData | null 
  }) {
    const verify = useMutation(api.insurance.verifyInsuranceByEncounter);
    const [loading, setLoading] = useState(false);

    const handleVerify = async () => {
    setLoading(true);
    
    // 1. Initial "Request Sent" notification
    toast.info("EDI 270 Request Sent", {
      description: "Transmitting to Clearinghouse (NPI: 1928374650)...",
      duration: 1500,
    });

    try {
      // 2. Execute the mutation
      const result = await verify({ encounterId });
      
      // Simulate a slight network delay for realism
      await new Promise((resolve) => setTimeout(resolve, 1200));
      
      setLoading(false);
      
      if (result === "Verified") {
        // 3. Success: Simulated 271 Response
        toast.success("EDI 271: Active Coverage", {
          description: "Eligibility: ACTIVE | Plan: PPO | Ded. Remaining: $450.00",
          duration: 5000,
        });
      } else {
        // 4. Denied: Validation Error
        toast.error("Eligibility Denied", {
          description: "Error Code 72: Subscriber Not Found. Check Member ID.",
          duration: 5000,
        });
      }
    } catch {
      setLoading(false);
      toast.error("System Error", { 
        description: "Gateway Timeout: Clearinghouse (Availity/Change Healthcare) unreachable." 
      });
    }
  };

  const status = insurance?.status || "pending";

  return (
    <div className="flex flex-col gap-3 p-5 bg-white rounded-[2rem] border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-slate-400" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Insurance Verification</span>
        </div>
        {insurance?.lastVerified && (
          <span className="text-[9px] font-bold text-slate-300 uppercase">
            Checked: {new Date(insurance.lastVerified).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="flex-1">
          <p className="text-lg font-black text-slate-900 leading-tight">
            {insurance?.provider || "Self-Pay / Uninsured"}
          </p>
          <p className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-tighter">
            ID: {insurance?.policyNumber || "N/A"}
          </p>
        </div>

        <button 
          onClick={handleVerify}
          disabled={loading || status === "verified" || !insurance}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all shadow-sm ${
            status === "verified" 
              ? "bg-emerald-500 text-white border-emerald-400" 
              : status === "denied"
              ? "bg-red-500 text-white border-red-400"
              : "bg-blue-600 text-white hover:bg-blue-700 active:scale-95"
          } disabled:opacity-50 disabled:active:scale-100`}
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : 
           status === "verified" ? <ShieldCheck className="h-3 w-3" /> : 
           status === "denied" ? <ShieldAlert className="h-3 w-3" /> : <Search className="h-3 w-3" />}
          {status === "verified" ? "Eligible" : status === "denied" ? "Failed" : "Verify"}
        </button>
      </div>

      {!insurance && (
        <p className="text-[9px] font-bold text-amber-600 bg-amber-50 p-2 rounded-lg border border-amber-100 italic">
          ⚠️ Action Required: No insurance record found for this patient ID.
        </p>
      )}
    </div>
  );
}