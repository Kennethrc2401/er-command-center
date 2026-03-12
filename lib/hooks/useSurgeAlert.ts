"use client";

import { useEffect, useRef } from "react";

export function useSurgeAlert(capacity: number) {
  const hasAlerted = useRef(false);

  const playSurgeChime = () => {
    const AudioContext = window.AudioContext || (window as unknown as Record<string, unknown>).webkitAudioContext;
    if (!AudioContext) return;

    const ctx = new AudioContext();
    const playTone = (freq: number, start: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
      
      gain.gain.setValueAtTime(0, ctx.currentTime + start);
      gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + start + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + 1);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + 1);
    };

    // 🎹 Professional "C-E" Chime
    playTone(523.25, 0);   // C5
    playTone(659.25, 0.1); // E5
  };

  useEffect(() => {
    // 🔔 Trigger alert at 90% capacity
    if (capacity >= 90 && !hasAlerted.current) {
      playSurgeChime();
      hasAlerted.current = true;
    } 
    // 🔄 Reset when capacity drops back down to 85% (Hysteresis)
    if (capacity < 85) {
      hasAlerted.current = false;
    }
  }, [capacity]);
}