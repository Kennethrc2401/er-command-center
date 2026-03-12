"use client";

import React from "react";

interface VitalsSparklineProps {
  data: { hr: number; timestamp: number }[];
  color?: string;
  width?: number;
  height?: number;
}

export default function VitalsSparkline({ 
  data, 
  color = "#3b82f6", 
  width = 120, 
  height = 40 
}: VitalsSparklineProps) {
  if (!data || data.length < 2) return <div className="h-10 w-30 bg-slate-50 rounded-lg animate-pulse" />;

  // 1. Sort by timestamp to ensure chronological order (left to right)
  const sortedData = [...data].sort((a, b) => a.timestamp - b.timestamp);
  
  // 2. Calculate Min/Max for scaling
  const hrs = sortedData.map(d => d.hr);
  const min = Math.min(...hrs) - 5; // Add padding
  const max = Math.max(...hrs) + 5;
  const range = max - min;

  // 3. Map values to SVG coordinates
  // X = index (spread across width), Y = HR value (scaled to height)
  const points = sortedData.map((d, i) => {
    const x = (i / (sortedData.length - 1)) * width;
    const y = height - ((d.hr - min) / range) * height;
    return `${x},${y}`;
  }).join(" ");

  return (
    <div className="flex flex-col gap-1">
      <svg width={width} height={height} className="overflow-visible">
        {/* The Sparkline Path */}
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
          className="drop-shadow-[0_2px_4px_rgba(59,130,246,0.3)]"
        />
        {/* Pulsing point at the most recent value */}
        <circle
          cx={width}
          cy={height - ((sortedData[sortedData.length - 1].hr - min) / range) * height}
          r="3"
          fill={color}
          className="animate-ping"
        />
      </svg>
      <div className="flex justify-between text-[8px] font-black uppercase text-slate-400 tracking-tighter">
        <span>{min + 5}</span>
        <span>{max - 5}</span>
      </div>
    </div>
  );
}