

interface VitalsPoint {
  time: string;
  hr: number;
  spO2: number;
  recordedAt: number;
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
    payload: VitalsPoint;
  }>;
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: TooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border border-slate-100 rounded-xl shadow-xl ring-1 ring-black/5">
        <p className="text-[10px] font-black text-slate-400 mb-2 uppercase tracking-tighter">
          Logged at {label}
        </p>
        <div className="space-y-1">
          {payload.map((entry) => (
            <div key={entry.name} className="flex items-center justify-between gap-4">
              <span className="text-[11px] font-bold text-slate-500">{entry.name}:</span>
              <span 
                style={{ color: entry.color }} 
                className="text-xs font-black"
              >
                {entry.value}{entry.name === 'SpO2' ? '%' : ''}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

export default CustomTooltip;
// Then use it like this:
{/* <Tooltip content={<CustomTooltip />} /> */}