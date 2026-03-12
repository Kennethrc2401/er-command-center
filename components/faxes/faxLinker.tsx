"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Search, User, Link as LinkIcon, X } from "lucide-react";
import { toast } from "sonner";

interface Fax {
  _id: Id<"faxes">;
  subject: string;
}

export default function FaxLinkerModal({ fax, onClose }: { fax: Fax, onClose: () => void }) {
  const [search, setSearch] = useState("");
  const patients = useQuery(api.patients.searchPatients, { query: search });
  const linkFax = useMutation(api.faxes.linkToPatient);

  interface Patient {
    _id: string;
    name: string;
    dob?: string;
  }

  const handleLink = async (patient: Patient) => {
    await linkFax({
      faxId: fax._id,
      patientId: patient._id as Id<"patients">,
      patientName: patient.name
    });
    toast.success(`Fax attached to ${patient.name}'s record`);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[300] flex items-center justify-center p-4">
      <div className="bg-white rounded-[3rem] w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden">
        <div className="p-8 bg-slate-900 text-white flex justify-between items-center">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-blue-400">Document Routing</p>
            <h2 className="text-2xl font-black italic uppercase italic">Link to Patient</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-8 space-y-6">
          <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex items-center gap-4">
            <div className="h-10 w-10 bg-blue-600 rounded-xl flex items-center justify-center text-white">
              <LinkIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase text-blue-400 leading-none mb-1">Source Document</p>
              <p className="text-xs font-bold text-slate-700 uppercase">{fax.subject}</p>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input 
              autoFocus
              placeholder="Search by Patient Name or MRN..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-50 border-2 border-slate-100 p-4 pl-12 rounded-2xl font-bold text-slate-900 focus:border-blue-500 outline-none transition-all"
            />
          </div>

          <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
            {patients?.map((p) => (
              <button 
                key={p._id}
                onClick={() => handleLink(p)}
                className="w-full flex items-center justify-between p-4 rounded-2xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 group-hover:bg-blue-100 group-hover:text-blue-600">
                    <User className="h-5 w-5" />
                  </div>
                  <div className="text-left">
                    <p className="font-black text-slate-900 uppercase text-xs">{p.name}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">DOB: {p.dob || "01/01/1980"}</p>
                  </div>
                </div>
                <LinkIcon className="h-4 w-4 text-slate-200 group-hover:text-blue-500" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}