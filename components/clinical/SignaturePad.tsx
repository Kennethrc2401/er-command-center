"use client";

import { useRef, useState, type MouseEvent, type TouchEvent } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { PenTool, Eraser, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function SignaturePad({ encounterId }: { encounterId: Id<"encounters"> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSigned, setHasSigned] = useState(false);
  const [consentToTreat, setConsentToTreat] = useState(false);
  const [hipaaAcknowledged, setHipaaAcknowledged] = useState(false);
  const saveSignature = useMutation(api.encounters.saveSignature);

  const getCanvasPoint = (
    e: MouseEvent<HTMLCanvasElement> | TouchEvent<HTMLCanvasElement>,
    rect: DOMRect
  ) => {
    if ("clientX" in e) {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }

    if (e.touches.length > 0) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }

    return {
      x: 0,
      y: 0,
    };
  };

  const startDrawing = (e: MouseEvent<HTMLCanvasElement> | TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const { x, y } = getCanvasPoint(e, rect);

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: MouseEvent<HTMLCanvasElement> | TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const rect = canvas.getBoundingClientRect();
    const { x, y } = getCanvasPoint(e, rect);

    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSigned(true);
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setHasSigned(false);
    }
  };

  const save = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (!consentToTreat || !hipaaAcknowledged) {
      toast.error("Both Consent to Treat and HIPAA acknowledgement are required.");
      return;
    }

    const signatureData = canvas.toDataURL("image/png");

    try {
      await saveSignature({
        encounterId,
        patientSignature: signatureData,
        signatureTimestamp: Date.now(),
        consentToTreat: true,
        hipaaAcknowledged: true,
      });
      toast.success("Signature Captured Successfully");
    } catch {
      toast.error("Failed to save signature.");
    }
  };

  return (
    <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 space-y-6 shadow-sm">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <PenTool className="h-4 w-4 text-blue-600" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Patient Consent Signature</span>
        </div>
        <button onClick={clear} className="text-[9px] font-black uppercase text-slate-400 hover:text-red-500 flex items-center gap-1 transition-all">
          <Eraser className="h-3 w-3" /> Clear
        </button>
      </div>

      <canvas
        ref={canvasRef}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={() => setIsDrawing(false)}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={() => setIsDrawing(false)}
        className="w-full h-48 bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl cursor-crosshair"
        width={600}
        height={200}
      />

      <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <label className="flex items-start gap-2 text-[10px] font-bold text-slate-700">
          <input
            type="checkbox"
            checked={consentToTreat}
            onChange={(event) => setConsentToTreat(event.target.checked)}
            className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300"
          />
          <span>I acknowledge and sign the Consent to Treat.</span>
        </label>
        <label className="flex items-start gap-2 text-[10px] font-bold text-slate-700">
          <input
            type="checkbox"
            checked={hipaaAcknowledged}
            onChange={(event) => setHipaaAcknowledged(event.target.checked)}
            className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300"
          />
          <span>I acknowledge receipt of the HIPAA Notice of Privacy Practices.</span>
        </label>
      </div>

      <button
        disabled={!hasSigned || !consentToTreat || !hipaaAcknowledged}
        onClick={save}
        className={`w-full py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all flex items-center justify-center gap-2 ${
          hasSigned && consentToTreat && hipaaAcknowledged
            ? "bg-slate-900 text-white hover:bg-slate-800"
            : "bg-slate-100 text-slate-300"
        }`}
      >
        <CheckCircle2 className="h-4 w-4" /> Finalize Consent
      </button>
    </div>
  );
}