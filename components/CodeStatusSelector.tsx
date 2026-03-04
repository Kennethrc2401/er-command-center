"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ShieldAlert, ShieldCheck, ChevronDown } from "lucide-react";
import { toast } from "sonner";

interface Props {
  patientId: Id<"patients">;
  currentStatus: "Full Code" | "DNR/DNI" | "DNR-Limited";
}

export default function CodeStatusSelector({ patientId, currentStatus }: Props) {
  const updateStatus = useMutation(api.patients.updateCodeStatus);

  const handleUpdate = async (status: "Full Code" | "DNR/DNI" | "DNR-Limited") => {
    await updateStatus({ patientId, status });
    toast.info(`Code Status updated to ${status}`);
  };

  const isDNR = currentStatus !== "Full Code";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          className={`h-8 px-3 rounded-full text-[10px] font-black uppercase tracking-widest gap-2 transition-all duration-500 ${
            isDNR 
            ? "bg-purple-600 text-white border-none hover:bg-purple-700" 
            : "bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100"
          }`}
        >
          {isDNR ? <ShieldAlert className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
          {currentStatus}
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="rounded-xl p-1 w-40">
        <DropdownMenuItem onClick={() => handleUpdate("Full Code")} className="text-[10px] font-bold uppercase tracking-widest">
          Full Code
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleUpdate("DNR/DNI")} className="text-[10px] font-bold uppercase tracking-widest text-purple-600">
          DNR / DNI
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleUpdate("DNR-Limited")} className="text-[10px] font-bold uppercase tracking-widest text-purple-600">
          DNR - Limited
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}