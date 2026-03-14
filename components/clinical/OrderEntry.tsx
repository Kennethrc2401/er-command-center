"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Beaker, Image as ImageIcon, Zap, Plus, Check, FlaskConical, Clock } from "lucide-react";
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
  const completeOrder = useMutation(api.orders.completeOrder);
  const existingOrders = useQuery(api.orders.getByEncounter, { encounterId });
  const [isStat, setIsStat] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [completing, setCompleting] = useState<string | null>(null);

  // Set of testNames that are active (PENDING or COMPLETED) for this encounter
  const orderedTestNames = new Set(
    (existingOrders ?? []).filter((o) => o.status !== "CANCELLED").map((o) => o.testName)
  );

  const handleOrder = async (test: typeof TEST_CATALOG[0]) => {
    if (orderedTestNames.has(test.name)) return;
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

  const handleComplete = async (orderId: Id<"orders">, testName: string, isStat: boolean) => {
    setCompleting(orderId);
    try {
      await completeOrder({ orderId });
      if (isStat) {
        toast.error(`STAT Result Ready: ${testName}`, {
          description: "Physician notification triggered. Immediate review required.",
          icon: <Zap className="h-4 w-4 text-amber-400" />,
          duration: 8000,
        });
      } else {
        toast.success(`${testName} Resulted`, {
          description: "Result is now available in the chart.",
          icon: <FlaskConical className="h-4 w-4 text-emerald-500" />,
        });
      }
    } catch {
      toast.error("Failed to update order status.");
    } finally {
      setCompleting(null);
    }
  };

  // Orders that are still awaiting a result
  const pendingOrders = (existingOrders ?? []).filter((o) => o.status === "PENDING");

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
            const isOrdered = orderedTestNames.has(test.name);
            const isLoading = loading === test.name;
            const existingOrder = (existingOrders ?? []).find((o) => o.testName === test.name && o.status !== "CANCELLED");
            return (
              <button
                key={test.name}
                disabled={isLoading || isOrdered}
                onClick={() => handleOrder(test)}
                className={`group flex items-center justify-between p-4 rounded-2xl border-2 transition-all text-left ${
                  isOrdered
                    ? "border-emerald-200 bg-emerald-50/60 opacity-80 cursor-default"
                    : isSuggested
                    ? "border-blue-400 bg-blue-50/70 shadow-sm shadow-blue-100"
                    : "border-transparent hover:border-blue-100 hover:bg-blue-50/50"
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center transition-all ${
                    isOrdered ? "bg-emerald-500 text-white" : isSuggested ? "bg-blue-500 text-white" : "bg-slate-50 text-slate-400 group-hover:bg-white group-hover:text-blue-500"
                  }`}>
                    {isOrdered ? <Check className="h-5 w-5" /> : test.type === "LAB" ? <Beaker className="h-5 w-5" /> : <ImageIcon className="h-5 w-5" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className={`text-xs font-bold tracking-tight ${
                        isOrdered ? "text-emerald-800" : isSuggested ? "text-blue-900" : "text-slate-800"
                      }`}>{test.name}</p>
                      {isOrdered ? (
                        <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 bg-emerald-500 text-white rounded-full">
                          {existingOrder?.priority === "STAT" ? "Ordered · STAT" : "Ordered"}
                        </span>
                      ) : isSuggested ? (
                        <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 bg-blue-500 text-white rounded-full">
                          Suggested
                        </span>
                      ) : null}
                    </div>
                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">{test.type}</p>
                  </div>
                </div>
                <div className={`h-8 w-8 rounded-full border-2 flex items-center justify-center transition-all ${
                  isOrdered
                    ? "border-emerald-400 bg-emerald-400 text-white"
                    : isSuggested
                    ? "border-blue-500 bg-blue-500 text-white"
                    : "border-slate-100 group-hover:border-blue-500 group-hover:bg-blue-500 group-hover:text-white"
                }`}>
                  {isOrdered ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                </div>
              </button>
            );
          })}
      </div>

      {/* ─── Pending Results Panel ──────────────────────────────────────
           Lab/imaging techs click "Result Ready" when the test comes back.
           For STAT orders this auto-fires the notification to the physician.
      ──────────────────────────────────────────────────────────────── */}
      {pendingOrders.length > 0 && (
        <div className="border-t border-slate-100 pt-6 space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Pending Results ({pendingOrders.length})
            </span>
          </div>
          {pendingOrders.map((order) => {
            const isStatOrder = order.priority === "STAT";
            const isCompletingThis = completing === order._id;
            return (
              <div
                key={order._id}
                className={`flex items-center justify-between p-4 rounded-2xl border-2 ${
                  isStatOrder
                    ? "border-amber-200 bg-amber-50/60"
                    : "border-slate-100 bg-slate-50/60"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${
                    isStatOrder ? "bg-amber-500 text-white" : "bg-slate-200 text-slate-500"
                  }`}>
                    {order.type === "LAB" ? <FlaskConical className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-slate-800">{order.testName}</p>
                      {isStatOrder && (
                        <span className="flex items-center gap-0.5 text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 bg-amber-500 text-white rounded-full">
                          <Zap className="h-2.5 w-2.5" /> STAT
                        </span>
                      )}
                    </div>
                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">
                      {order.type} · Awaiting Result
                    </p>
                  </div>
                </div>
                <button
                  disabled={isCompletingThis}
                  onClick={() => handleComplete(order._id, order.testName, isStatOrder)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                    isStatOrder
                      ? "bg-red-500 hover:bg-red-600 text-white"
                      : "bg-emerald-500 hover:bg-emerald-600 text-white"
                  } disabled:opacity-60 disabled:cursor-not-allowed`}
                >
                  {isCompletingThis ? (
                    <span className="animate-pulse">Saving…</span>
                  ) : (
                    <>
                      <Check className="h-3 w-3" />
                      Result Ready
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}