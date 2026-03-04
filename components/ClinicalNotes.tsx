"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { useState } from "react";
import { 
  FileText, 
  Save, 
  Loader2, 
  LayoutTemplate, 
  BookOpen,
  History as HistoryIcon,
  Activity,
  Droplets,
  ClipboardList,
  Clock
} from "lucide-react";
import { toast } from "sonner";

type NoteType = "Progress Note" | "Consult" | "Procedure";

export default function ClinicalNotes({ encounterId }: { encounterId: Id<"encounters"> }) {
  // --- CONVEX HOOKS ---
  const notes = useQuery(api.notes.getByEncounter, { encounterId });
  const labs = useQuery(api.labs.getByEncounter, { encounterId });
  const saveNote = useMutation(api.notes.create);

  // --- STATE ---
  const [newNote, setNewNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [noteType, setNoteType] = useState<NoteType>("Progress Note");

  // --- SMART LOGIC ---
  const hasSpecimens = (labs?.length ?? 0) > 0;

  // --- TEMPLATE ENGINE ---
  const applyTemplate = (type: "SOAP" | "EKG" | "PHLEBOTOMY" | "CONSULT") => {
    const now = new Date().toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });

    const templates = {
      SOAP: "SUBJECTIVE:\n- \n\nOBJECTIVE:\n- \n\nASSESSMENT:\n- \n\nPLAN:\n- ",
      EKG: `PROCEDURE: 12-Lead EKG\nPERFORMED AT: ${now}\nFINDINGS: Normal Sinus Rhythm. No ST-segment elevation or depression noted. No ectopy.\nPATIENT TOLERANCE: Patient tolerated procedure well. Baseline vitals stable.`,
      PHLEBOTOMY: `PROCEDURE: Venipuncture / Blood Draw\nPERFORMED AT: ${now}\nSITE: R Antecubital fossa\nDEVICE: 21g straight needle\nSPECIMENS: Obtained CBC, BMP. Labeled at bedside and sent to lab.\nHEMOSTASIS: Achieved. Dressing applied. Patient tolerated well.`,
      CONSULT: "REASON FOR CONSULT:\nPHYSICAL EXAM:\nASSESSMENT:\nRECOMMENDATIONS:\n1. "
    };

    if (!newNote || confirm("Overwrite current draft with template?")) {
      setNewNote(templates[type]);
      
      if (type === "EKG" || type === "PHLEBOTOMY") setNoteType("Procedure");
      if (type === "CONSULT") setNoteType("Consult");
      if (type === "SOAP") setNoteType("Progress Note");
      
      toast.info(`${type} template applied with timestamp: ${now}`);
    }
  };

  // --- HANDLERS ---
  const handleSave = async () => {
    if (!newNote.trim() || isSaving) return;

    setIsSaving(true);
    try {
      await saveNote({
        encounterId,
        content: newNote,
        type: noteType 
      });
      setNewNote("");
      toast.success("Electronic Signature Applied", {
        description: "Clinical record finalized and timestamped."
      });
    } catch (error) {
      console.error("Clinical Documentation Error:", error);
      toast.error("Signature Unauthorized", {
        description: "Access Denied: MD/DO credentials required for signature."
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-blue-100 shadow-md overflow-hidden bg-white">
        <CardHeader className="pb-3 bg-slate-50/50 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-slate-600">
              <FileText className="h-4 w-4 text-blue-600" />
              Scribe: Active Entry
            </CardTitle>

            <Select value={noteType} onValueChange={(value) => setNoteType(value as NoteType)}>
              <SelectTrigger className="w-45 h-8 text-[10px] bg-white border-blue-200 font-black uppercase tracking-wider">
                <SelectValue placeholder="Select Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Progress Note" className="text-xs">Progress Note</SelectItem>
                <SelectItem value="Consult" className="text-xs">Consult</SelectItem>
                <SelectItem value="Procedure" className="text-xs">Procedure</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        
        <CardContent className="pt-4">
          <div className="flex flex-col gap-2 mb-4 pb-3 border-b border-slate-100">
            <span className="text-[9px] font-black text-slate-400 flex items-center gap-1 uppercase tracking-widest">
              <LayoutTemplate className="h-3 w-3" /> Quick Scribe Templates:
            </span>
            <div className="flex flex-wrap gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[10px] px-3 font-bold border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition-all"
                onClick={() => applyTemplate("SOAP")}
              >
                <ClipboardList className="h-3.5 w-3.5 mr-1" /> SOAP
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[10px] px-3 font-bold border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-red-600 transition-all"
                onClick={() => applyTemplate("EKG")}
              >
                <Activity className="h-3.5 w-3.5 mr-1" /> EKG FINDINGS
              </Button>
              
              {/* SMART PHLEBOTOMY BUTTON */}
              <Button
                variant="outline"
                size="sm"
                className={`h-7 text-[10px] px-3 font-bold transition-all relative ${
                  hasSpecimens 
                    ? "border-emerald-500 text-emerald-700 bg-emerald-50 shadow-sm" 
                    : "border-slate-200 text-slate-600 hover:bg-emerald-50 hover:border-emerald-200"
                }`}
                onClick={() => applyTemplate("PHLEBOTOMY")}
              >
                <Droplets className={`h-3.5 w-3.5 mr-1 ${hasSpecimens ? "animate-bounce text-emerald-600" : ""}`} />
                PHLEBOTOMY
                {hasSpecimens && (
                  <span className="absolute -top-1 -right-1 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                )}
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[10px] px-3 font-bold border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-purple-600 transition-all"
                onClick={() => applyTemplate("CONSULT")}
              >
                <BookOpen className="h-3.5 w-3.5 mr-1" /> CONSULT
              </Button>
            </div>
          </div>

          <Textarea
            placeholder="Begin clinical documentation..."
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            className="mb-4 min-h-50 resize-none focus-visible:ring-blue-500 border-slate-200 font-serif text-sm leading-relaxed p-5 bg-slate-50/20 italic text-slate-800"
            disabled={isSaving}
          />

          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
              <p className="text-[9px] text-slate-400 font-black uppercase tracking-tighter italic">
                CPOE: Sign-off will apply digital clinical signature
              </p>
            </div>
            <Button
              onClick={handleSave}
              size="sm"
              className="gap-2 bg-slate-900 hover:bg-black text-white font-black uppercase text-[10px] tracking-widest shadow-lg px-8 py-5 h-auto transition-transform active:scale-95"
              disabled={isSaving || !newNote.trim()}
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Finalize {noteType}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4 pt-4">
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-3">
          <HistoryIcon className="h-3 w-3" />
          Shift Timeline
          <div className="h-px flex-1 bg-slate-200/50" />
        </h3>

        {notes?.length === 0 && (
          <div className="text-center py-24 border-2 border-dashed rounded-3xl border-slate-100 bg-slate-50/20">
            <BookOpen className="h-10 w-10 text-slate-200 mx-auto mb-3" />
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Awaiting Physician Documentation</p>
          </div>
        )}

        {notes?.map((note) => (
          <div key={note._id} className="relative pl-8 pb-4 group">
            <div className="absolute left-3.75 top-0 bottom-0 w-px bg-slate-100 group-last:bg-transparent" />
            <div className="absolute left-2.75 top-7 w-2 h-2 rounded-full bg-blue-500 ring-4 ring-white shadow-sm" />

            <div className="p-6 bg-white border border-slate-200 rounded-3xl shadow-sm hover:shadow-md hover:border-blue-200 transition-all duration-300">
              <div className="flex justify-between items-start mb-5">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-2xl bg-blue-600 flex items-center justify-center text-sm font-black text-white shadow-blue-100 shadow-xl">
                    {(note.authorName || "U").charAt(0)}
                  </div>
                  <div>
                    <span className="text-[13px] font-black text-slate-800 block leading-none mb-1">
                      {note.authorName}
                    </span>
                    <span className="text-[9px] text-blue-600 font-black uppercase tracking-widest bg-blue-50 px-1.5 py-0.5 rounded">
                      {note.authorRole}
                    </span>
                  </div>
                </div>
                
                <div className="flex flex-col items-end gap-1">
                  <span className="text-[10px] font-mono font-bold text-slate-400 flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                    <Clock className="h-3 w-3" />
                    {new Date(note.signedAt || note._creationTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                </div>
              </div>

              <div className="relative pl-5 border-l-2 border-slate-50 group-hover:border-blue-50 transition-colors">
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-serif italic">
                  &quot;{note.content}&quot;
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-50 flex justify-between items-center">
                <div className="flex items-center gap-2">
                   <div className={`h-1.5 w-1.5 rounded-full ${
                      note.type === 'Procedure' ? 'bg-amber-500' :
                      note.type === 'Consult' ? 'bg-purple-500' : 'bg-blue-500'
                    }`} />
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                      Verified {note.type}
                    </span>
                </div>
                <span className="text-[8px] font-mono text-slate-300">AUTH: {note._id.slice(-8).toUpperCase()}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}