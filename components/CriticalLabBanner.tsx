"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";

interface LabAlert {
  _id: Id<"labResults">;
  testName: string;
  value: string;
  unit: string;
}

export default function CriticalLabBanner({ alerts }: { alerts: LabAlert[] }) {
  const acknowledge = useMutation(api.labs.acknowledgeLab);

  if (alerts.length === 0) return null;

  const handleAcknowledgeAll = async () => {
    try {
      // Loop through all abnormal labs and sign them off
      await Promise.all(
        alerts.map((lab) =>
          acknowledge({
            labId: lab._id,
            staffName: "Sophia Ramirez, CCMA", // Hardcoded for clinical context
          })
        )
      );
      toast.success("Critical labs acknowledged and logged to chart.");
    } catch (error) {
      toast.error("Error acknowledging lab results.");
      console.error(error);
    }
  };

  return (
    <Alert 
      variant="destructive" 
      className="border-2 border-red-600 bg-red-50 animate-in slide-in-from-top-4 duration-500 rounded-2xl shadow-lg mb-6"
    >
      <AlertCircle className="h-5 w-5" />
      <div className="flex items-center justify-between w-full">
        <div className="pr-4">
          <AlertTitle className="text-[10px] font-black uppercase tracking-[0.2em] mb-1">
            Critical Lab Result Alert
          </AlertTitle>
          <AlertDescription className="text-xs font-bold text-red-900 leading-tight">
            {alerts.length} abnormal result(s) detected:{" "}
            <span className="font-black">
              {alerts.map((a, i) => (
                <span key={a._id}>
                  {a.testName} ({a.value} {a.unit}){i < alerts.length - 1 ? ", " : ""}
                </span>
              ))}
            </span>
          </AlertDescription>
        </div>
        
        <Button 
          onClick={handleAcknowledgeAll}
          size="sm" 
          variant="destructive" 
          className="h-9 px-4 text-[10px] font-black uppercase tracking-widest gap-2 bg-red-600 hover:bg-red-700 shadow-md transition-all active:scale-95 shrink-0"
        >
          <CheckCheck className="h-4 w-4" /> Sign Off Results
        </Button>
      </div>
    </Alert>
  );
}