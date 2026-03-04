"use client";

import React, { useEffect, useRef } from "react";

interface EKGProps {
  bpm: number;
  isUnstable?: boolean;
}

export default function EKGMonitor({ bpm, isUnstable }: EKGProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let x = 0;
    const height = canvas.height;
    const width = canvas.width;
    const mid = height / 2;

    // Calculate speed based on BPM
    // Faster BPM = closer peaks
    const step = (bpm / 60) * 2; 

    const draw = () => {
      // Create trailing effect
      ctx.fillStyle = "rgba(15, 23, 42, 0.05)"; // Slate-900 with alpha
      ctx.fillRect(x, 0, 20, height);

      ctx.strokeStyle = isUnstable ? "#ef4444" : "#10b981"; // Red if unstable, Emerald if normal
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, mid);

      // Simple P-QRS-T Wave Simulation
      const cycle = x % (600 / (bpm / 60));
      let y = mid;

      if (cycle > 10 && cycle < 20) y -= 5; // P wave
      if (cycle >= 20 && cycle < 25) y += 2; // PR segment
      if (cycle >= 25 && cycle < 28) y += 5; // Q
      if (cycle >= 28 && cycle < 32) y -= 30; // R (The big spike)
      if (cycle >= 32 && cycle < 35) y += 35; // S
      if (cycle >= 35 && cycle < 45) y = mid; // ST segment
      if (cycle >= 45 && cycle < 60) y -= 8; // T wave

      ctx.lineTo(x + 2, y);
      ctx.stroke();

      x = (x + 2) % width;
      requestAnimationFrame(draw);
    };

    const anim = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(anim);
  }, [bpm, isUnstable]);

  return (
    <div className="bg-slate-900 p-4 rounded-[2rem] border border-slate-800 shadow-inner">
      <div className="flex justify-between items-center mb-2 px-2">
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Lead II - Live</span>
        <span className={`text-[10px] font-black uppercase ${isUnstable ? 'text-red-500 animate-pulse' : 'text-emerald-500'}`}>
          {isUnstable ? 'Arrhythmia Detected' : 'Sinus Rhythm'}
        </span>
      </div>
      <canvas 
        ref={canvasRef} 
        width={400} 
        height={100} 
        className="w-full h-24"
      />
    </div>
  );
}