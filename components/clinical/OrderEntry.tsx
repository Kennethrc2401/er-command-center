"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Beaker, Image as ImageIcon, Zap, Plus, Check } from "lucide-react";
import { toast } from "sonner";
import { Id } from "@/convex/_generated/dataModel";

const TEST_CATALOG = [
  { name: "CBC with Diff", type: "LAB" },
  { name: "Basic Metabolic Panel (BMP)", type: "LAB" },
  { name: "Troponin I", type: "LAB" },
  { name: "Urinalysis", type: "LAB" },
  { name: "Chest X-Ray 2-View", type: "IMAGING" },
  { name: "CT Head Non-Contrast", type: "IMAGING" },
  { name: "US Abdomen Complete", type: "IMAGING" },
];

export default function OrderEntry({ patientId, encounterId, suggestedOrders = [] }: {
  patientId: Id<"patients">;
  encounterId: Id<"encounters">;
  suggestedOrders?: string[];
}) {
  const placeOrder = useMutation(api.orders.placeOrder);
  const [isStat, setIsStat] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  const handleOrder = async (test: typeof TEST_CATALOG[0]) => {
    setLoading(test.name);
    try {
      await placeOrder({
        patientId,
        encounterId,
        testName: test.name,
        type: test.type as "LAB" | "IMAGING",
        priority: isStat ? "STAT" : "ROUTINE",
      });
      toast.success(`${test.name} Ordered`, {
        description: isStat ? "Priority: STAT (Expected < 60m)" : "Priority: Routine",
        icon: isStat ? <Zap className="h-4 w-4 text-amber-500" /> : <Check className="h-4 w-4 text-emerald-500" />
      });
    } catch {
      toast.error("Order failed to transmit to department.");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 space-y-6 shadow-sm">
      <header className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Beaker className="h-4 w-4 text-blue-600" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Order Management</span>
        </div>
        
        <button 
          onClick={() => setIsStat(!isStat)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 transition-all ${
            isStat ? "bg-amber-50 border-amber-200 text-amber-600" : "bg-slate-50 border-slate-100 text-slate-400"
          }`}
        >
          <Zap className={`h-3 w-3 ${isStat ? "fill-amber-500" : ""}`} />
          <span className="text-[9px] font-black uppercase tracking-widest">STAT Priority</span>
        </button>
      </header>

      <div className="grid grid-cols-1 gap-2">
          {TEST_CATALOG.map((test) => {
            const isSuggested = suggestedOrders.includes(test.name);
            return (
              <button
                key={test.name}
                disabled={loading === test.name}
                onClick={() => handleOrder(test)}
                className={`group flex items-center justify-between p-4 rounded-2xl border-2 transition-all text-left ${
                  isSuggested
                    ? "border-blue-400 bg-blue-50/70 shadow-sm shadow-blue-100"
                    : "border-transparent hover:border-blue-100 hover:bg-blue-50/50"
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center transition-all ${
                    isSuggested ? "bg-blue-500 text-white" : "bg-slate-50 text-slate-400 group-hover:bg-white group-hover:text-blue-500"
                  }`}>
                    {test.type === "LAB" ? <Beaker className="h-5 w-5" /> : <ImageIcon className="h-5 w-5" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className={`text-xs font-bold tracking-tight ${isSuggested ? "text-blue-900" : "text-slate-800"}`}>{test.name}</p>
                      {isSuggested && (
                        <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 bg-blue-500 text-white rounded-full">
                          Suggested
                        </span>
                      )}
                    </div>
                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">{test.type}</p>
                  </div>
                </div>
                <div className={`h-8 w-8 rounded-full border-2 flex items-center justify-center transition-all ${
                  isSuggested
                    ? "border-blue-500 bg-blue-500 text-white"
                    : "border-slate-100 group-hover:border-blue-500 group-hover:bg-blue-500 group-hover:text-white"
                }`}>
                  <Plus className="h-4 w-4" />
                </div>
              </button>
            );
          })}
      </div>
    </div>
  );
}