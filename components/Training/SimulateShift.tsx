"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Play, Users, Loader2 } from "lucide-react";
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
      className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl text-[10px] font-black uppercase border border-emerald-100 hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
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