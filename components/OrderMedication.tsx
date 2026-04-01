"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { checkAllergyConflict } from "@/lib/safety";
import { AlertCircle, PlusCircle, PenTool, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

interface OrderProps {
  encounterId: Id<"encounters">;
  patientId: Id<"patients">;
  patientAllergies: string[];
}

const HIGH_ALERT_MEDS = ["Insulin", "Heparin", "Warfarin", "Fentanyl", "Morphine", "Amiodarone"];

export default function OrderMedication({ encounterId, patientId, patientAllergies }: OrderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [medName, setMedName] = useState("");
  const [dosage, setDosage] = useState("");
  const [route, setRoute] = useState("IV");
  
  const createOrder = useMutation(api.medications.createOrder);
  const { hasConflict, allergen } = checkAllergyConflict(patientAllergies, medName);

  const isHighAlert = HIGH_ALERT_MEDS.some(m => 
    medName.toLowerCase().includes(m.toLowerCase())
  );

  const handleOrder = async () => {
    try {
      await createOrder({
        patientId,
        encounterId,
        name: medName,
        dosage,
        route,
        orderedBy: "Dr. Sophia Amanda Ramirez, MD", // Authenticated signature
      });
      
      toast.success("Order Signed & Sent", {
        description: `${medName} ${dosage} ${route} has been added to the eMAR.`,
      });
      
      setIsOpen(false);
      setMedName("");
      setDosage("");
    } catch {
      toast.error("Order Entry Failed", {
        description: "Please check clinical connectivity and try again.",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="gap-2 border-blue-200 text-blue-700 hover:bg-blue-50 transition-all dark:border-blue-500/40 dark:bg-blue-950/30 dark:text-blue-200 dark:hover:bg-blue-900/40"
        >
          <PlusCircle className="h-4 w-4" /> New Medication Order
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-106.25 border-t-4 border-t-blue-600 dark:border-slate-700 dark:border-t-blue-500">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
            <PenTool className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <span className="rounded-md bg-blue-50 px-2 py-1 text-[13px] font-black tracking-tight text-blue-800 dark:bg-blue-500/20 dark:text-blue-100">
              Computerized Provider Order Entry (CPOE)
            </span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          {/* Order Summary Preview */}
          {medName && dosage && (
            <div className={`p-3 rounded-lg border flex flex-col gap-1 ${isHighAlert ? 'bg-orange-50 border-orange-200' : 'bg-blue-50 border-blue-200'}`}>
              <div className="flex justify-between items-center">
                <p className={`text-[10px] font-black uppercase tracking-widest ${isHighAlert ? 'text-orange-600' : 'text-blue-600'}`}>
                  {isHighAlert ? "High-Alert Order Summary" : "Order Summary"}
                </p>
                {isHighAlert && <ShieldAlert className="h-3 w-3 text-orange-600 animate-pulse" />}
              </div>
              <p className="text-sm font-bold text-slate-900">
                {medName} {dosage} {route}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-black uppercase text-slate-500 tracking-wider">Medication Name</label>
            <Input 
              placeholder="e.g. Aspirin" 
              value={medName} 
              onChange={(e) => setMedName(e.target.value)}
              className={hasConflict ? "border-red-500 focus-visible:ring-red-500 bg-red-50/30" : "bg-slate-50/50"}
            />
            {hasConflict && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 p-2 rounded-md text-[11px] font-bold border border-red-100">
                <AlertCircle className="h-4 w-4 shrink-0" />
                CONTRAINDICATION: Patient allergic to {allergen}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-black uppercase text-slate-500 tracking-wider">Dosage</label>
              <Input 
                placeholder="e.g. 325mg" 
                value={dosage} 
                onChange={(e) => setDosage(e.target.value)} 
                className="bg-slate-50/50"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black uppercase text-slate-500 tracking-wider">Route</label>
              <select 
                className="h-10 w-full rounded-md border bg-slate-50/50 px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                value={route}
                onChange={(e) => setRoute(e.target.value)}
              >
                <option value="PO" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">PO (Oral)</option>
                <option value="IV" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">IV</option>
                <option value="IM" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">IM</option>
                <option value="SubQ" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">SubQ</option>
                <option value="PR" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">PR (Rectal)</option>
              </select>
            </div>
          </div>

          {/* Electronic Signature Block */}
          <div className="mt-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 dark:border-blue-400/40 dark:bg-blue-950/30">
            <p className="mb-1 text-[9px] font-black uppercase tracking-tighter text-slate-500 dark:text-blue-200">Legal Attestation & Signature</p>
            <p className="text-sm font-serif italic text-slate-800 dark:text-slate-100">Sophia Amanda Ramirez, MD</p>
            <p className="mt-1 text-[9px] text-slate-500 dark:text-blue-200/90">
              Time: {new Date().toLocaleTimeString()} | ID: SAR-2026-CCMA
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={() => setIsOpen(false)} className="text-slate-500">
            Discard
          </Button>
          <Button 
            onClick={handleOrder} 
            disabled={!medName || !dosage || hasConflict}
            className={`font-bold ${
              isHighAlert 
                ? "bg-orange-600 hover:bg-orange-700 text-white shadow-orange-100 shadow-lg" 
                : "bg-blue-600 hover:bg-blue-700 text-white"
            }`}
          >
            {isHighAlert ? "Sign High-Alert Order" : "Sign & Send Order"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}