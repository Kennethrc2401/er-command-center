"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Video, VideoOff, Mic, MicOff, PhoneOff, UserPlus, Activity } from "lucide-react";
import { toast } from "sonner";

interface TeleConsultProps {
  encounterId: Id<"encounters">;
  patientId: Id<"patients">;
  userId: Id<"users">;
}

export default function TeleConsult({ encounterId, patientId, userId }: TeleConsultProps) {
  const [isActive, setIsActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  
  // Convex mutations to track the consult state
  const startConsult = useMutation(api.consults.start);

  const handleStart = async () => {
    setIsActive(true);
    await startConsult({
      encounterId,
      patientId,
      specialty: "Neurology",
      userId,
      roomName: `nexus-room-${encounterId.slice(0, 5)}`
    });
    toast.success("Tele-Stroke Specialist Paged", {
      description: "Encrypted video tunnel established."
    });
  };

  if (!isActive) {
    return (
      <button 
        onClick={handleStart}
        className="w-full group bg-blue-600 hover:bg-blue-500 p-8 rounded-[2.5rem] text-white flex flex-col items-center gap-4 transition-all shadow-xl shadow-blue-200"
      >
        <div className="h-16 w-16 bg-white/20 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
          <Video className="h-8 w-8 text-white" />
        </div>
        <div className="text-center">
          <p className="text-xs font-black uppercase tracking-widest">Start Tele-Consult</p>
          <p className="text-[10px] text-blue-100 mt-1 font-medium">Connect with On-Call Specialist</p>
        </div>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-900 z-2000 flex flex-col">
      {/* 📹 VIDEO FEED AREA */}
      <div className="flex-1 relative overflow-hidden flex items-center justify-center">
        {/* Mock Remote Specialist Feed */}
        <div className="absolute inset-0 bg-linear-to-br from-slate-800 to-slate-950 flex items-center justify-center">
          <div className="text-center animate-pulse">
            <UserPlus className="h-12 w-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400 font-black uppercase text-[10px] tracking-widest">Waiting for Specialist...</p>
          </div>
        </div>

        {/* 👤 LOCAL SELF-VIEW (PIP) */}
        <div className="absolute top-8 right-8 w-48 h-32 bg-black rounded-3xl border-2 border-white/10 shadow-2xl overflow-hidden">
           <div className="w-full h-full bg-slate-700 flex items-center justify-center">
              <p className="text-[8px] font-black uppercase text-slate-500">Local Camera</p>
           </div>
        </div>

        {/* 📊 FLOATING VITALS OVERLAY (The Clinical "Edge") */}
        <div className="absolute bottom-32 left-8 bg-black/40 backdrop-blur-md p-6 rounded-[2rem] border border-white/10 flex items-center gap-6">
           <div className="flex flex-col">
              <span className="text-[8px] font-black text-blue-400 uppercase">Heart Rate</span>
              <span className="text-2xl font-black text-white italic">102 <span className="text-[10px] not-italic text-slate-500">BPM</span></span>
           </div>
           <div className="h-8 w-px bg-white/10" />
           <div className="flex flex-col">
              <span className="text-[8px] font-black text-emerald-400 uppercase">SpO2</span>
              <span className="text-2xl font-black text-white italic">96<span className="text-[10px] not-italic text-slate-500">%</span></span>
           </div>
           <Activity className="h-5 w-5 text-red-500 animate-pulse ml-4" />
        </div>
      </div>

      {/* 🎮 CALL CONTROLS */}
      <div className="h-28 bg-black/80 backdrop-blur-xl border-t border-white/5 flex items-center justify-center gap-6">
        <button 
          onClick={() => setIsMuted(!isMuted)}
          className={`h-14 w-14 rounded-full flex items-center justify-center transition-all ${isMuted ? 'bg-red-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
        >
          {isMuted ? <MicOff /> : <Mic />}
        </button>
        
        <button 
          onClick={() => setIsActive(false)}
          className="h-16 w-24 bg-red-600 hover:bg-red-500 rounded-[2rem] flex items-center justify-center text-white transition-all shadow-lg shadow-red-900/40"
        >
          <PhoneOff className="h-6 w-6" />
        </button>

        <button 
          onClick={() => setVideoOff(!videoOff)}
          className={`h-14 w-14 rounded-full flex items-center justify-center transition-all ${videoOff ? 'bg-red-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
        >
          {videoOff ? <VideoOff /> : <Video />}
        </button>
      </div>
    </div>
  );
}