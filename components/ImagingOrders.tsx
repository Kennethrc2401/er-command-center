"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Scan, 
  ChevronRight,
  FlaskConical,
  Activity
} from "lucide-react";
import { Button } from "./ui/button";
import PlaceImagingOrder from "./PlaceImagingOrder";
import { toast } from "sonner";
import ViewImagingReport from "./ViewImagingReport";

export default function ImagingOrders({
  encounterId,
  actorName,
}: {
  encounterId: Id<"encounters">;
  actorName?: string;
}) {
  const orders = useQuery(api.imaging.getByEncounter, { encounterId });
  const finalizeSimulatedResult = useMutation(api.imaging.finalizeSimulatedResult);

  const handleSimulateResult = async (orderId: Id<"imagingOrders">) => {
    try {
      await finalizeSimulatedResult({ orderId });
      toast.success("Radiology Report Finalized");
    } catch {
      toast.error("Simulation failed");
    }
  };

  if (orders === undefined) return (
    <div className="h-40 w-full bg-slate-50 animate-pulse rounded-2xl flex items-center justify-center">
      <Activity className="h-6 w-6 text-slate-300 animate-spin" />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 p-5 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-2">
          <Scan className="h-5 w-5 text-blue-600" />
          <div>
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-600 leading-none">Radiology Tracking</h3>
            <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">CPOE & PACS Integration</p>
          </div>
        </div>
        <PlaceImagingOrder encounterId={encounterId} orderedBy={actorName} />
      </div>

      {orders.length === 0 && (
        <div className="text-center py-20 bg-slate-50/10 border-2 border-dashed rounded-3xl border-slate-200">
          <Scan className="h-10 w-10 text-slate-200 mx-auto mb-3" />
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">No Radiology Orders Found</p>
        </div>
      )}

      {orders.map((order) => (
        <Card key={order._id} className="border-slate-200 overflow-hidden shadow-sm hover:border-blue-200 transition-all bg-white">
          <CardContent className="p-0">
            <div className="flex items-stretch">
              <div className={`w-1.5 ${
                order.status === 'Resulted' ? 'bg-emerald-500' : 
                order.status === 'In Progress' ? 'bg-blue-500 animate-pulse' : 'bg-slate-300'
              }`} />
              
              <div className="flex-1 p-5">
                <div className="flex justify-between items-start mb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge className={`text-[9px] font-black uppercase ${
                        order.priority === 'STAT' ? "bg-red-100 text-red-700 border-none animate-pulse" : "bg-slate-100 text-slate-600"
                      }`}>
                        {order.priority}
                      </Badge>
                      <span className="text-sm font-black text-slate-800 tracking-tight">{order.studyName}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Indication: {order.reason}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-mono font-bold text-slate-400 block mb-1">
                      {new Date(order.orderedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <Badge variant="outline" className="text-[8px] font-black text-blue-600 border-blue-100 uppercase">{order.modality}</Badge>
                  </div>
                </div>

                <div className="flex items-center justify-between bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-6">
                    {['Ordered', 'In Progress', 'Resulted'].map((step, i) => (
                      <div key={step} className="flex items-center gap-2">
                        <div className={`h-2 w-2 rounded-full ${
                          (step === order.status) ? 'bg-blue-500 ring-4 ring-blue-100' : 
                          (i < ['Ordered', 'In Progress', 'Resulted'].indexOf(order.status)) ? 'bg-emerald-500' : 'bg-slate-200'
                        }`} />
                        <span className="text-[9px] font-black text-slate-600 uppercase">{step}</span>
                        {i < 2 && <ChevronRight className="h-3 w-3 text-slate-300" />}
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    {order.status !== 'Resulted' && (
                      <Button 
                        onClick={() => handleSimulateResult(order._id)}
                        variant="outline" size="sm" 
                        className="h-7 text-[9px] font-black uppercase text-slate-400 border-slate-100 hover:bg-emerald-50 hover:text-emerald-600"
                      >
                        <FlaskConical className="h-3 w-3 mr-1" /> Simulate Result
                      </Button>
                    )}
                    {order.status === 'Resulted' && (
                      <ViewImagingReport 
                        orderId={order._id}
                        studyName={order.studyName}
                        modality={order.modality}
                        report={order.report}
                        orderingPhysician={order.orderedBy}
                        simulatedSeries={order.simulatedSeries}
                        resultedAt={order.orderedAt}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}