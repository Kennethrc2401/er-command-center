"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Users, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function SimulateShift() {
  const seed = useMutation(api.encounters.seedMockPatient);
  const [loading, setLoading] = useState(false);

  const handleSimulate = async () => {
    setLoading(true);
    try {
      await seed();
      toast.success("New Patient Triage Complete", {
        description: "A mock encounter has been added to the queue."
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleSimulate}
      disabled={loading}
      className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-[10px] font-black uppercase text-emerald-700 shadow-sm transition-all hover:bg-emerald-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Users className="h-4 w-4" />
      )}
      Simulate Intake
    </button>
  );
}