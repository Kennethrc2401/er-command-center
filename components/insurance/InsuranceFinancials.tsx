import { Badge } from "lucide-react";

// components/InsuranceFinancials.tsx
interface InsuranceData {
  planType?: string;
  coPayAmount?: string | number;
  authStatus?: string;
}

export default function InsuranceFinancials({ insurance }: { insurance: InsuranceData }) {
  return (
    <div className="p-6 bg-slate-900 rounded-[2rem] text-white shadow-xl border border-slate-800">
      <div className="flex justify-between items-start mb-4">
        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 italic">Financial Summary</h4>
        <Badge className="bg-blue-500/10 text-blue-400 border-none text-[8px] font-black italic">
          {insurance?.planType || "PPO"}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50">
          <p className="text-[9px] font-black uppercase text-slate-500 mb-1">ER Co-pay</p>
          <p className="text-2xl font-black italic text-emerald-400">
            ${insurance?.coPayAmount || "150"}
          </p>
        </div>
        <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50">
          <p className="text-[9px] font-black uppercase text-slate-500 mb-1">Auth Status</p>
          <p className={`text-xs font-bold uppercase ${insurance?.authStatus === 'approved' ? 'text-emerald-400' : 'text-amber-400'}`}>
            {insurance?.authStatus?.replace('_', ' ') || "NOT REQUIRED"}
          </p>
        </div>
      </div>

      <button className="w-full py-3 bg-white text-slate-900 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-colors">
        Log Co-pay Collection
      </button>
    </div>
  );
}