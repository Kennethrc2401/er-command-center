import { BarChart3, TrendingUp, Badge } from "lucide-react";

import { Card, CardContent } from "../ui/card";
export default function UnitRevenueSummary({ stats, isPresentationMode }: { stats: Record<string, unknown>, isPresentationMode: boolean }) {
  void stats;
  return (
    <Card className="border-slate-200 shadow-sm rounded-[2.5rem] overflow-hidden bg-white">
      <div className="bg-slate-900 p-5 flex justify-between items-center px-8">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-4 w-4 text-blue-400" />
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 italic">Unit Revenue Analytics</span>
        </div>
        {isPresentationMode && <Badge className="bg-emerald-500/20 text-emerald-400 border-none text-[8px] font-black uppercase">Board Ready</Badge>}
      </div>
      
      <CardContent className="p-8">
        {isPresentationMode ? (
          /* PRESENTATION MODE: Visual Graphs */
          <div className="space-y-8 animate-in fade-in zoom-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Payer Mix Distribution</p>
                <div className="h-4 bg-slate-100 rounded-full overflow-hidden flex">
                  <div className="h-full bg-blue-500 w-[60%]" title="Commercial" />
                  <div className="h-full bg-emerald-500 w-[25%]" title="Medicare" />
                  <div className="h-full bg-amber-500 w-[15%]" title="Self-Pay" />
                </div>
                <div className="flex justify-between text-[8px] font-bold text-slate-500 uppercase">
                  <span>Commercial (60%)</span>
                  <span>Public (25%)</span>
                  <span>Self (15%)</span>
                </div>
              </div>
              
              <div className="flex items-center justify-center p-6 bg-slate-50 rounded-[2rem] border border-dashed border-slate-200">
                 <div className="text-center">
                    <TrendingUp className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                    <p className="text-xs font-black text-slate-900 uppercase italic">Revenue Up 12%</p>
                    <p className="text-[9px] text-slate-400 font-bold uppercase">vs Previous Shift</p>
                 </div>
              </div>
            </div>
          </div>
        ) : (
          /* NORMAL MODE: Detailed Data */
          <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-[9px] font-black uppercase text-slate-400 mb-1">Expected Reimbursement</p>
                <p className="text-xl font-black text-slate-900">$12,450.00</p>
              </div>
              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                <p className="text-[9px] font-black uppercase text-emerald-600 mb-1">POS Cash Collected</p>
                <p className="text-xl font-black text-emerald-700">$1,250.00</p>
              </div>
              <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                <p className="text-[9px] font-black uppercase text-blue-600 mb-1">Clean Claim Rate</p>
                <p className="text-xl font-black text-blue-700">98.2%</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}