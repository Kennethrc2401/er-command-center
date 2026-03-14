"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

// ── Canvas geometry ────────────────────────────────────────────────────────────
const MM_PX     = 3;          // canvas pixels per millimetre
const LARGE_BOX = 5 * MM_PX;  // 15 px  (one 5 mm large box)
const CANVAS_W  = 750;
const CANVAS_H  = 180;
const BASELINE  = CANVAS_H / 2;

// ── Per-lead PQRST amplitude multipliers ─────────────────────────────────────
const LEADS: Record<string, { P: number; Q: number; R: number; S: number; T: number }> = {
  "II":  { P: 1.00, Q: 0.08, R: 1.00, S: 0.25, T: 0.90 },
  "I":   { P: 0.80, Q: 0.05, R: 0.75, S: 0.15, T: 0.85 },
  "V1":  { P: 0.50, Q: 0.00, R: 0.20, S: 1.40, T: -0.60 },
  "V5":  { P: 0.90, Q: 0.12, R: 1.40, S: 0.10, T: 1.10 },
  "aVF": { P: 0.85, Q: 0.10, R: 0.85, S: 0.35, T: 0.80 },
};

// ── Helpers ────────────────────────────────────────────────────────────────────
function gauss(t: number, mu: number, sigma: number) {
  return Math.exp(-((t - mu) ** 2) / (2 * sigma ** 2));
}

/**
 * Returns instantaneous ECG voltage in mV for beat-phase t ∈ [0, 1).
 * Timing fractions are Bazett-scaled with the current RR interval so intervals
 * widen at slower rates (bradycardia) and narrow at faster rates (tachycardia).
 */
function ecgMV(t: number, lead: string, rrSec: number, isUnstable: boolean): number {
  const m = LEADS[lead] ?? LEADS["II"];
  // Clamp rate-scaling so morphology stays plausible at extremes
  const rs = Math.min(Math.max(Math.sqrt(rrSec), 0.65), 1.25);

  // Wave centres and widths (fractions of RR interval)
  const pC = 0.10 * rs,  pW = 0.024 * rs;
  const qC = 0.176,      qW = 0.008;
  const rC = 0.192,      rW = 0.012;
  const sC = 0.212,      sW = 0.010;
  const tC = Math.min(0.185 + 0.22 * rs, 0.78), tW = 0.052 * rs;

  let v = 0;
  if (!isUnstable) v += m.P * 0.15  * gauss(t, pC, pW); // P (absent in A-fib)
  v -= m.Q  * 0.10  * gauss(t, qC, qW);
  v += m.R  * 1.50  * gauss(t, rC, rW);
  v -= m.S  * 0.35  * gauss(t, sC, sW);
  v += m.T  * 0.35  * gauss(t, tC, tW);

  // Ischaemic ST depression when unstable
  if (isUnstable && t > sC + 0.022 && t < tC - 0.030) v -= 0.08;

  return v;
}

function rhythmLabel(bpm: number, unstable: boolean): string {
  if (unstable)    return "Atrial Fibrillation";
  if (bpm < 40)    return "Severe Bradycardia";
  if (bpm < 60)    return "Sinus Bradycardia";
  if (bpm <= 100)  return "Normal Sinus Rhythm";
  if (bpm <= 150)  return "Sinus Tachycardia";
  return "Supraventricular Tachycardia";
}

function traceHex(bpm: number, unstable: boolean): string {
  if (unstable)              return "#f87171"; // red-400
  if (bpm < 50 || bpm > 130) return "#fbbf24"; // amber-400
  return "#34d399";                            // emerald-400
}

// ── Props ──────────────────────────────────────────────────────────────────────
interface EKGProps {
  bpm: number;
  isUnstable?: boolean;
}

export default function EKGMonitor({ bpm, isUnstable = false }: EKGProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [paused,     setPaused]     = useState(false);
  const [muted,      setMuted]      = useState(true);   // muted by default
  const [gain,       setGain]       = useState<5 | 10 | 20>(10);

  // Persists across re-renders; never closed during the component lifetime
  const audioCtxRef = useRef<AudioContext | null>(null);
  const [sweepSpeed, setSweepSpeed] = useState<25 | 50>(25);
  const [activeLead, setActiveLead] = useState("II");

  // Refs allow the animation loop to read the latest control values without
  // restarting the requestAnimationFrame loop on every UI change.
  const pausedRef    = useRef(paused);
  const mutedRef     = useRef(muted);
  const gainRef      = useRef(gain);
  const sweepRef     = useRef(sweepSpeed);
  const leadRef      = useRef(activeLead);
  useEffect(() => { pausedRef.current   = paused;      }, [paused]);
  useEffect(() => { mutedRef.current    = muted;       }, [muted]);
  useEffect(() => { gainRef.current     = gain;        }, [gain]);

  // Lazily creates the AudioContext on first unmute, then reuses it.
  const playBeep = useCallback(() => {
    if (mutedRef.current) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const ac = audioCtxRef.current;
      if (ac.state === "suspended") ac.resume();
      const osc = ac.createOscillator();
      const gn  = ac.createGain();
      osc.connect(gn);
      gn.connect(ac.destination);
      // Normal sinus: 880 Hz soft "bip". Unstable/A-fib: 660 Hz amber tone.
      osc.type = "sine";
      osc.frequency.value = isUnstable ? 660 : 880;
      const t = ac.currentTime;
      gn.gain.setValueAtTime(0, t);
      gn.gain.linearRampToValueAtTime(0.18, t + 0.005);   // fast attack
      gn.gain.exponentialRampToValueAtTime(0.001, t + 0.09); // smooth decay
      osc.start(t);
      osc.stop(t + 0.13);
    } catch { /* AudioContext blocked — silently ignore */ }
  }, [isUnstable]);

  // Stable ref so the animation loop always calls the latest version
  const playBeepRef = useRef(playBeep);
  useEffect(() => { playBeepRef.current = playBeep; }, [playBeep]);
  useEffect(() => { sweepRef.current    = sweepSpeed;  }, [sweepSpeed]);
  useEffect(() => { leadRef.current     = activeLead;  }, [activeLead]);

  // ── Animation loop ─────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = CANVAS_W, H = CANVAS_H;

    // Pre-render the ECG grid to an offscreen canvas once — avoids re-drawing
    // hundreds of grid lines every animation frame.
    const offscreen = document.createElement("canvas");
    offscreen.width  = W;
    offscreen.height = H;
    const octx = offscreen.getContext("2d")!;

    octx.fillStyle = "#060d16";
    octx.fillRect(0, 0, W, H);
    // 1 mm small squares
    octx.strokeStyle = "rgba(52,211,153,0.06)";
    octx.lineWidth = 0.5;
    for (let x = 0; x <= W; x += MM_PX) { octx.beginPath(); octx.moveTo(x, 0); octx.lineTo(x, H); octx.stroke(); }
    for (let y = 0; y <= H; y += MM_PX) { octx.beginPath(); octx.moveTo(0, y); octx.lineTo(W, y); octx.stroke(); }
    // 5 mm large squares
    octx.strokeStyle = "rgba(52,211,153,0.17)";
    octx.lineWidth = 0.8;
    for (let x = 0; x <= W; x += LARGE_BOX) { octx.beginPath(); octx.moveTo(x, 0); octx.lineTo(x, H); octx.stroke(); }
    for (let y = 0; y <= H; y += LARGE_BOX) { octx.beginPath(); octx.moveTo(0, y); octx.lineTo(W, y); octx.stroke(); }
    // Isoelectric baseline (dashed)
    octx.strokeStyle = "rgba(52,211,153,0.13)";
    octx.lineWidth = 1;
    octx.setLineDash([4, 4]);
    octx.beginPath(); octx.moveTo(0, BASELINE); octx.lineTo(W, BASELINE); octx.stroke();
    octx.setLineDash([]);

    // Pixel y-buffer: one entry per canvas column
    const buffer = new Float32Array(W).fill(BASELINE);

    let scanX  = 0;    // float scan-line x position (pixels)
    let phase  = 0;    // fractional beat phase [0, 1)
    let currRR = 60 / Math.max(bpm, 10); // seconds per beat
    let lastTs: number | null = null;

    const nextRR = () => {
      const base = 60 / Math.max(bpm, 10);
      // A-fib: randomise RR ±30 % per beat to simulate irregularity
      return isUnstable ? base * (0.70 + Math.random() * 0.60) : base;
    };

    let animId: number;

    const frame = (ts: number) => {
      if (lastTs === null) lastTs = ts;
      const dt = Math.min((ts - lastTs) / 1000, 0.05); // cap at 50 ms
      lastTs = ts;

      if (!pausedRef.current) {
        const pxPerSec = sweepRef.current * MM_PX;
        const advance  = pxPerSec * dt;
        // Sub-pixel steps so we never miss a pixel column
        const steps = Math.max(1, Math.floor(advance) + 1);

        for (let i = 0; i < steps; i++) {
          phase += (dt / steps) / currRR;
          if (phase >= 1) { phase -= 1; currRR = nextRR(); playBeepRef.current(); }

          const p  = Math.max(0, Math.min(0.999, phase));
          const mV = ecgMV(p, leadRef.current, currRR, isUnstable);

          // A-fib baseline wander: slow sinusoid + small noise
          const noise = isUnstable
            ? Math.sin(ts * 0.031 + i * 0.7) * 0.04 + (Math.random() - 0.5) * 0.025
            : 0;

          const yPx = BASELINE - (mV + noise) * gainRef.current * MM_PX;
          const px  = Math.floor(scanX + (i / steps) * advance) % W;
          buffer[px] = Math.max(4, Math.min(H - 4, yPx));
        }

        scanX = (scanX + advance) % W;
      }

      // ── Render ────────────────────────────────────────────────────────────
      // Blit pre-rendered grid (clears the previous frame instantly)
      ctx.drawImage(offscreen, 0, 0);

      // Blank "eraser" block just ahead of the scan cursor (real-monitor feel)
      const eraseW = Math.ceil(LARGE_BOX * 2.2);

      const color = traceHex(bpm, isUnstable);
      ctx.shadowColor = color;
      ctx.shadowBlur  = 6;
      ctx.strokeStyle = color;
      ctx.lineWidth   = 1.8;
      ctx.beginPath();

      let drawing = false;
      for (let x = 0; x < W; x++) {
        const dist = ((x - Math.floor(scanX)) % W + W) % W;
        if (dist < eraseW) { drawing = false; continue; }
        if (!drawing) { ctx.moveTo(x, buffer[x]); drawing = true; }
        else          { ctx.lineTo(x, buffer[x]); }
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      animId = requestAnimationFrame(frame);
    };

    animId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(animId);
  }, [bpm, isUnstable]);

  // ── Analytics (derived from props + UI state) ───────────────────────────────
  const rrMs   = Math.round(60000 / Math.max(bpm, 1));
  // PR shortens mildly with rate (first-degree AV block flag > 200 ms)
  const prMs   = isUnstable ? null : Math.round(180 - 0.3 * bpm);
  // QRS widens slightly in unstable/aberrant patterns
  const qrsDur = isUnstable ? 108 : 86;
  // Approximate QT from clinical rule; Bazett-corrected QTc
  const qtMs   = Math.round(Math.max(300, 450 - 1.75 * bpm));
  const qtcMs  = Math.round(qtMs / Math.sqrt(rrMs / 1000));
  // R-wave amplitude in mm at current gain and lead
  const rAmpMm = ((LEADS[activeLead]?.R ?? 1) * 1.5 * gain).toFixed(1);
  const stMm   = isUnstable ? "−1.0" : "+0.0";
  const rhythm = rhythmLabel(bpm, isUnstable);
  const color  = traceHex(bpm, isUnstable);

  const stats = [
    { label: "HR",    value: String(bpm),          unit: "bpm", warn: bpm < 50 || bpm > 130 },
    { label: "RR",    value: String(rrMs),          unit: "ms",  warn: false },
    { label: "PR",    value: prMs ? String(prMs) : "—", unit: "ms", warn: !prMs || (!!prMs && (prMs > 200 || prMs < 120)) },
    { label: "QRS",   value: String(qrsDur),        unit: "ms",  warn: qrsDur > 120 },
    { label: "QT",    value: String(qtMs),           unit: "ms",  warn: false },
    { label: "QTc",   value: String(qtcMs),          unit: "ms",  warn: qtcMs > 450 },
    { label: "R amp", value: rAmpMm,                 unit: "mm",  warn: parseFloat(rAmpMm) > 25 },
    { label: "ST Δ",  value: stMm,                   unit: "mm",  warn: isUnstable },
  ];

  return (
    <div className="bg-slate-950 rounded-2xl border border-slate-800 shadow-xl overflow-hidden text-white">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-900 border-b border-slate-800">
        <span className="h-2 w-2 rounded-full shrink-0 animate-pulse" style={{ backgroundColor: color }} />
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mr-auto">
          EKG Monitor
        </span>
        <span className="text-[10px] font-black uppercase tracking-wider" style={{ color }}>
          {rhythm}
        </span>
        <div className="flex items-baseline gap-1 ml-3">
          <span className="text-2xl font-black tabular-nums leading-none" style={{ color }}>{bpm}</span>
          <span className="text-[9px] text-slate-500">bpm</span>
        </div>
      </div>

      {/* ── Controls ───────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5 bg-slate-900/70 border-b border-slate-800/60 text-[9px]">

        {/* Lead selector */}
        <div className="flex items-center gap-1">
          <span className="text-slate-500 font-bold uppercase tracking-wider mr-0.5">Lead</span>
          {Object.keys(LEADS).map(l => (
            <button
              key={l}
              onClick={() => setActiveLead(l)}
              className={`px-1.5 py-0.5 rounded font-black uppercase tracking-wider border transition-colors ${
                activeLead === l
                  ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                  : "text-slate-500 hover:text-slate-300 border-transparent"
              }`}
            >
              {l}
            </button>
          ))}
        </div>

        <span className="h-3 w-px bg-slate-700" />

        {/* Gain (amplitude) */}
        <div className="flex items-center gap-1">
          <span className="text-slate-500 font-bold uppercase tracking-wider mr-0.5">Gain</span>
          {([5, 10, 20] as const).map(g => (
            <button
              key={g}
              onClick={() => setGain(g)}
              className={`px-1.5 py-0.5 rounded font-black border transition-colors ${
                gain === g
                  ? "bg-blue-500/20 text-blue-400 border-blue-500/40"
                  : "text-slate-500 hover:text-slate-300 border-transparent"
              }`}
            >
              {g}
            </button>
          ))}
          <span className="text-slate-600 font-medium">mm/mV</span>
        </div>

        <span className="h-3 w-px bg-slate-700" />

        {/* Sweep speed */}
        <div className="flex items-center gap-1">
          <span className="text-slate-500 font-bold uppercase tracking-wider mr-0.5">Speed</span>
          {([25, 50] as const).map(s => (
            <button
              key={s}
              onClick={() => setSweepSpeed(s)}
              className={`px-1.5 py-0.5 rounded font-black border transition-colors ${
                sweepSpeed === s
                  ? "bg-purple-500/20 text-purple-400 border-purple-500/40"
                  : "text-slate-500 hover:text-slate-300 border-transparent"
              }`}
            >
              {s}
            </button>
          ))}
          <span className="text-slate-600 font-medium">mm/s</span>
        </div>

        {/* Mute / sound toggle */}
        <button
          onClick={() => {
            // Resume AudioContext on first unmute (browser autoplay policy)
            if (muted && !audioCtxRef.current) {
              audioCtxRef.current = new AudioContext();
            }
            setMuted(m => !m);
          }}
          title={muted ? "Enable heartbeat sound" : "Mute heartbeat sound"}
          className={`px-2.5 py-0.5 rounded font-black uppercase tracking-wider border transition-colors ${
            muted
              ? "text-slate-500 hover:text-slate-300 border-slate-700"
              : "bg-emerald-500/15 text-emerald-400 border-emerald-500/40"
          }`}
        >
          {muted ? "🔇 MUTED" : "🔔 SOUND"}
        </button>

        {/* Freeze / run */}
        <button
          onClick={() => setPaused(p => !p)}
          className={`ml-auto px-2.5 py-0.5 rounded font-black uppercase tracking-wider border transition-colors ${
            paused
              ? "bg-amber-500/15 text-amber-400 border-amber-500/40"
              : "text-slate-400 hover:text-slate-200 border-slate-700"
          }`}
        >
          {paused ? "▶ RUN" : "⏸ FREEZE"}
        </button>
      </div>

      {/* ── Canvas ─────────────────────────────────────────────────────────── */}
      <div className="relative">
        <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} className="w-full block" />
        {paused && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[9px] font-black uppercase tracking-widest animate-pulse">
              ⏸ FROZEN
            </span>
          </div>
        )}
      </div>

      {/* ── Analytics strip ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 sm:grid-cols-8 divide-x divide-slate-800/80 border-t border-slate-800 bg-slate-900">
        {stats.map(({ label, value, unit, warn }) => (
          <div key={label} className="flex flex-col items-center py-2 px-1 gap-0.5">
            <span className="text-[8px] font-bold uppercase tracking-widest text-slate-600">{label}</span>
            <span className={`text-sm font-black tabular-nums leading-tight ${warn ? "text-red-400" : "text-slate-200"}`}>
              {value}
            </span>
            <span className="text-[8px] text-slate-600 leading-tight">{unit}</span>
          </div>
        ))}
      </div>
    </div>
  );
}