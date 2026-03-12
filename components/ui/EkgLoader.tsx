import { cn } from "@/lib/utils";

type EkgLoaderProps = {
  message?: string;
  className?: string;
};

const EKG_PATH =
  "M0 48 H18 L30 48 L40 30 L52 72 L64 48 H88 L98 48 L106 16 L116 82 L128 48 H160 L172 48 L182 34 L194 60 L206 48 H320";

export function EkgLoader({ message = "Syncing patient telemetry...", className }: EkgLoaderProps) {
  return (
    <div className={cn("w-full", className)}>
      <div className="relative overflow-hidden rounded-3xl border border-cyan-300/30 bg-slate-950/95 p-6 shadow-[0_20px_80px_-36px_rgba(6,182,212,0.85)]">
        <div className="ekg-grid pointer-events-none absolute inset-0 opacity-60" />

        <div className="relative space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-200/85">
              Emergency Telemetry
            </p>
            <span className="ekg-status-dot" aria-hidden />
          </div>

          <div className="relative h-24 overflow-hidden rounded-xl border border-cyan-200/20 bg-slate-950/80">
            <svg
              viewBox="0 0 320 96"
              className="h-full w-full"
              role="img"
              aria-label="Animated EKG waveform"
              preserveAspectRatio="none"
            >
              <path d={EKG_PATH} className="ekg-trace-muted" />
              <path d={EKG_PATH} className="ekg-trace" />
            </svg>
            <div className="ekg-scanline" aria-hidden />
          </div>

          <p className="text-center text-[11px] font-black uppercase tracking-[0.18em] text-cyan-100/80">
            {message}
          </p>
        </div>
      </div>
    </div>
  );
}