"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, UserCircle } from "lucide-react";
import { toast } from "sonner";

interface MedHistoryProps {
  encounterId: Id<"encounters">;
}

export default function MedicationHistory({ encounterId }: MedHistoryProps) {
  // 1. Fetch medications for this encounter
  const medications = useQuery(api.medications.getByEncounter, { encounterId });
  const administerMed = useMutation(api.medications.administer);

  if (!medications) return <div className="animate-pulse h-20 bg-slate-50 rounded-xl" />;

  const handleAdminister = async (id: Id<"medications">) => {
    try {
      await administerMed({ medicationId: id });
      toast.success("Medication Documented", {
        description: "Status updated to Administered by Sophia R, RN",
      });
    } catch {
      toast.error("Documentation Error");
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
        <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
          <Clock className="h-4 w-4" /> eMAR / Medication History
        </h3>
      </div>
      
      <Table>
        <TableHeader className="bg-slate-50/50">
          <TableRow>
            <TableHead className="text-[10px] uppercase font-bold">Medication</TableHead>
            <TableHead className="text-[10px] uppercase font-bold">Order Details</TableHead>
            <TableHead className="text-[10px] uppercase font-bold">Ordered By</TableHead>
            <TableHead className="text-[10px] uppercase font-bold">Status</TableHead>
            <TableHead className="text-right text-[10px] uppercase font-bold">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {medications.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center py-8 text-slate-400 text-xs italic">
                No medication orders found for this encounter.
              </TableCell>
            </TableRow>
          ) : (
            medications.map((med) => (
              <TableRow key={med._id} className="hover:bg-slate-50/50 transition-colors">
                <TableCell className="font-bold text-slate-900">{med.name}</TableCell>
                <TableCell>
                  <div className="text-xs text-slate-600 font-medium">
                    {med.dosage} • {med.route}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 text-[11px] text-slate-500">
                    <UserCircle className="h-3 w-3" /> {med.orderedBy}
                  </div>
                </TableCell>
                <TableCell>
                  {med.status === "administered" ? (
                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1 hover:bg-emerald-50">
                      <CheckCircle2 className="h-3 w-3" /> Administered
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50/50">
                      Pending
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {med.status !== "administered" && (
                    <Button 
                      size="sm" 
                      onClick={() => handleAdminister(med._id)}
                      className="bg-blue-600 hover:bg-blue-700 h-7 text-[10px] px-3 font-bold"
                    >
                      Administer
                    </Button>
                  )}
                  {med.status === "administered" && (
                    <span className="text-[10px] font-bold text-slate-400 italic">
                      {med.adminBy}
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}