"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useResolvedActor } from "@/lib/hooks/useResolvedActor";
import { Send, UserRound } from "lucide-react";
import { toast } from "sonner";

interface OutboundFaxComposerProps {
  triggerLabel?: string;
  defaultPatientId?: Id<"patients">;
  defaultEncounterId?: Id<"encounters">;
  defaultSubject?: string;
  defaultRecipientName?: string;
  buttonClassName?: string;
}

export default function OutboundFaxComposer({
  triggerLabel = "Compose Outbound",
  defaultPatientId,
  defaultEncounterId,
  defaultSubject = "Clinical Packet",
  defaultRecipientName = "",
  buttonClassName,
}: OutboundFaxComposerProps) {
  const { actorName } = useResolvedActor();
  const sendOutbound = useMutation(api.faxes.sendOutbound);
  const [open, setOpen] = useState(false);
  const [recipientName, setRecipientName] = useState(defaultRecipientName);
  const [toFaxNumber, setToFaxNumber] = useState("");
  const [subject, setSubject] = useState(defaultSubject);
  const [coverMessage, setCoverMessage] = useState("");
  const [patientSearch, setPatientSearch] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState<Id<"patients"> | undefined>(defaultPatientId);
  const patients = useQuery(api.patients.searchPatients, { query: patientSearch });

  const handleSend = async () => {
    try {
      await sendOutbound({
        recipientName,
        toFaxNumber,
        subject,
        coverMessage,
        patientId: selectedPatientId,
        encounterId: defaultEncounterId,
        sentBy: actorName,
      });
      toast.success("Outbound fax queued");
      setOpen(false);
      setToFaxNumber("");
      setCoverMessage("");
      setPatientSearch("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to send outbound fax.";
      toast.error(message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className={buttonClassName ?? "bg-blue-600 text-white hover:bg-blue-500"}>
          <Send className="mr-2 h-4 w-4" /> {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Outbound Fax Composer</DialogTitle>
          <DialogDescription>Route discharge packets, consult notes, or outside-record requests to an external destination.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Recipient Name</Label>
            <Input value={recipientName} onChange={(event) => setRecipientName(event.target.value)} placeholder="Receiving office or facility" />
          </div>
          <div className="space-y-1.5">
            <Label>Fax Number</Label>
            <Input value={toFaxNumber} onChange={(event) => setToFaxNumber(event.target.value)} placeholder="(201) 555-0199" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Subject</Label>
          <Input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Discharge packet / consult note / records request" />
        </div>

        <div className="space-y-1.5">
          <Label>Linked Patient</Label>
          <Input value={patientSearch} onChange={(event) => setPatientSearch(event.target.value)} placeholder="Search patient by name or MRN" />
          {patients && patients.length > 0 && (
            <div className="max-h-32 space-y-2 overflow-y-auto rounded-2xl border border-slate-200 p-2 dark:border-slate-800">
              {patients.map((patient) => (
                <button
                  key={patient._id}
                  type="button"
                  onClick={() => {
                    setSelectedPatientId(patient._id);
                    setPatientSearch(patient.name);
                  }}
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-900"
                >
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{patient.name}</span>
                  <UserRound className="h-4 w-4 text-slate-400" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>Cover Message</Label>
          <Textarea value={coverMessage} onChange={(event) => setCoverMessage(event.target.value)} placeholder="Include routing notes, callback number, or packet contents" className="min-h-28" />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => void handleSend()} className="bg-emerald-600 text-white hover:bg-emerald-700">Send Fax</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
