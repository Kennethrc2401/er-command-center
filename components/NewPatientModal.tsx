"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";

// Added interface to support the custom trigger from Navbar
interface NewPatientModalProps {
  trigger?: React.ReactNode;
}

export default function NewPatientModal({ trigger }: NewPatientModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const admit = useMutation(api.encounters.admitPatient);
  const [complaint, setComplaint] = useState("");

  const COMMON_COMPLAINTS = ["Chest Pain", "SOB", "Abdominal Pain", "Fall/Injury", "Fever"];

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsPending(true);

    const formData = new FormData(e.currentTarget);
    
    try {
      await admit({
        name: formData.get("name") as string,
        mrn: `MRN-${Math.floor(1000 + Math.random() * 9000)}`, 
        dob: formData.get("dob") as string,
        gender: formData.get("gender") as string,
        chiefComplaint: complaint, // Use state-controlled complaint
        acuity: Number(formData.get("acuity")),
        // CAPTURING INITIAL VITALS
        vitals: { 
          hr: Number(formData.get("hr")), 
          bp: formData.get("bp") as string, 
          temp: Number(formData.get("temp")), 
          spO2: Number(formData.get("spO2")) 
        },
      });
      
      toast.success("Patient admitted with baseline vitals.");
      setComplaint(""); // Reset local state
      setIsOpen(false);
    } catch (error) {
      console.error("Admissions error:", error);
      toast.error("Failed to admit patient. Please check all fields.");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger ? trigger : (
          <Button className="bg-blue-600 hover:bg-blue-700 gap-2 font-bold shadow-sm">
            <UserPlus className="h-4 w-4" /> New Intake
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-125">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">ER Intake & Triage</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          {/* PATIENT INFO */}
          <div className="space-y-1">
            <Label htmlFor="name">Patient Full Name</Label>
            <Input id="name" name="name" placeholder="John Doe" required disabled={isPending} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="dob">DOB</Label>
              <Input id="dob" name="dob" type="date" required disabled={isPending} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="gender">Gender</Label>
              <select
                id="gender"
                name="gender"
                defaultValue=""
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                required
                disabled={isPending}
              >
                <option value="" disabled>Select...</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
                <option value="Unknown">Unknown</option>
              </select>
            </div>
          </div>

          {/* TRIAGE INFO */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="acuity">ESI Level</Label>
              <select
                id="acuity"
                name="acuity"
                defaultValue="3"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                disabled={isPending}
              >
                <option value="1">1 - Resuscitation</option>
                <option value="2">2 - Emergent</option>
                <option value="3">3 - Urgent</option>
                <option value="4">4 - Less Urgent</option>
                <option value="5">5 - Non-Urgent</option>
              </select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="complaint">Chief Complaint</Label>
              <Input
                id="complaint"
                name="complaint"
                placeholder="e.g. Chest pain"
                required
                disabled={isPending}
                value={complaint}
                onChange={(e) => setComplaint(e.target.value)}
              />
            </div>
          </div>

          {/* QUICK SELECT BADGES */}
          <div className="flex flex-wrap gap-1.5 pb-2">
            {COMMON_COMPLAINTS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setComplaint(item)}
                className="px-2 py-1 text-[10px] font-bold bg-slate-100 text-slate-600 rounded-md hover:bg-blue-100 hover:text-blue-700 transition-colors border border-slate-200"
              >
                + {item}
              </button>
            ))}
          </div>

          {/* INITIAL VITALS SECTION */}
          <div className="pt-2 border-t border-slate-100">
            <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">Initial Vitals</Label>
            <div className="grid grid-cols-4 gap-3 mt-2">
              <div className="space-y-1">
                <Label htmlFor="bp" className="text-[10px] text-slate-500">BP</Label>
                <Input id="bp" name="bp" placeholder="120/80" className="h-8 text-xs px-2" required disabled={isPending} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="hr" className="text-[10px] text-slate-500">HR</Label>
                <Input id="hr" name="hr" type="number" placeholder="80" className="h-8 text-xs px-2" required disabled={isPending} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="spO2" className="text-[10px] text-slate-500">SpO2%</Label>
                <Input id="spO2" name="spO2" type="number" placeholder="98" className="h-8 text-xs px-2" required disabled={isPending} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="temp" className="text-[10px] text-slate-500">Temp</Label>
                <Input id="temp" name="temp" type="number" step="0.1" placeholder="98.6" className="h-8 text-xs px-2" required disabled={isPending} />
              </div>
            </div>
          </div>

          <Button type="submit" className="w-full bg-blue-600 font-bold mt-2" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing Intake...
              </>
            ) : (
              "Complete Admission"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}