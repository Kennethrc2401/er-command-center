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

function formatPhoneInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 10);

  if (digits.length < 4) return digits;
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function formatPostalInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 9);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function normalizeStateInput(value: string) {
  return value.replace(/[^a-z]/gi, "").toUpperCase().slice(0, 2);
}

export default function NewPatientModal({ trigger }: NewPatientModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const admit = useMutation(api.encounters.admitPatient);
  const [complaint, setComplaint] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("");

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
        phoneNumber: phoneNumber.trim() || undefined,
        emailAddress: (formData.get("emailAddress") as string)?.trim() || undefined,
        preferredLanguage: (formData.get("preferredLanguage") as string)?.trim() || undefined,
        addressLine1: (formData.get("addressLine1") as string)?.trim() || undefined,
        addressLine2: (formData.get("addressLine2") as string)?.trim() || undefined,
        city: (formData.get("city") as string)?.trim() || undefined,
        state: stateCode || undefined,
        postalCode: postalCode || undefined,
        emergencyContactName: (formData.get("emergencyContactName") as string)?.trim() || undefined,
        emergencyContactPhone: emergencyContactPhone.trim() || undefined,
        emergencyContactRelation: (formData.get("emergencyContactRelation") as string)?.trim() || undefined,
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
      setPhoneNumber("");
      setPostalCode("");
      setStateCode("");
      setEmergencyContactPhone("");
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

      <DialogContent className="sm:max-w-125 max-h-[90vh] overflow-y-auto">
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
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                required
                disabled={isPending}
              >
                <option value="" disabled className="bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">Select...</option>
                <option value="Male" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">Male</option>
                <option value="Female" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">Female</option>
                <option value="Other" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">Other</option>
                <option value="Unknown" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">Unknown</option>
              </select>
            </div>
          </div>

          <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-900/50">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-300">
              Optional Contact And Demographics
            </Label>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="phoneNumber">Phone Number</Label>
                <Input
                  id="phoneNumber"
                  name="phoneNumber"
                  placeholder="(555) 123-4567"
                  value={phoneNumber}
                  onChange={(event) => setPhoneNumber(formatPhoneInput(event.target.value))}
                  disabled={isPending}
                  inputMode="tel"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="emailAddress">Email</Label>
                <Input id="emailAddress" name="emailAddress" type="email" placeholder="name@example.com" disabled={isPending} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="preferredLanguage">Preferred Language</Label>
                <Input id="preferredLanguage" name="preferredLanguage" placeholder="English" disabled={isPending} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="addressLine1">Address Line 1</Label>
                <Input id="addressLine1" name="addressLine1" placeholder="123 Main St" disabled={isPending} />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label htmlFor="addressLine2">Address Line 2</Label>
                <Input id="addressLine2" name="addressLine2" placeholder="Apt, suite, unit (optional)" disabled={isPending} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="city">City</Label>
                <Input id="city" name="city" placeholder="Seattle" disabled={isPending} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  name="state"
                  placeholder="WA"
                  value={stateCode}
                  onChange={(event) => setStateCode(normalizeStateInput(event.target.value))}
                  disabled={isPending}
                  maxLength={2}
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label htmlFor="postalCode">Postal Code</Label>
                <Input
                  id="postalCode"
                  name="postalCode"
                  placeholder="98101"
                  value={postalCode}
                  onChange={(event) => setPostalCode(formatPostalInput(event.target.value))}
                  disabled={isPending}
                  inputMode="numeric"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-900/50">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-300">
              Optional Emergency Contact
            </Label>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="emergencyContactName">Name</Label>
                <Input id="emergencyContactName" name="emergencyContactName" placeholder="Jane Doe" disabled={isPending} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="emergencyContactPhone">Phone</Label>
                <Input
                  id="emergencyContactPhone"
                  name="emergencyContactPhone"
                  placeholder="(555) 123-4567"
                  value={emergencyContactPhone}
                  onChange={(event) => setEmergencyContactPhone(formatPhoneInput(event.target.value))}
                  disabled={isPending}
                  inputMode="tel"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="emergencyContactRelation">Relationship</Label>
                <Input id="emergencyContactRelation" name="emergencyContactRelation" placeholder="Spouse" disabled={isPending} />
              </div>
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
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                disabled={isPending}
              >
                <option value="1" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">1 - Resuscitation</option>
                <option value="2" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">2 - Emergent</option>
                <option value="3" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">3 - Urgent</option>
                <option value="4" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">4 - Less Urgent</option>
                <option value="5" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">5 - Non-Urgent</option>
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