"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRightLeft, BedDouble, MapPin, Route, Sparkles, UserRound } from "lucide-react";
import { toast } from "sonner";

type RoomFlowStage = NonNullable<Doc<"encounters">["flowStage"]>;
type DelayReason = NonNullable<Doc<"encounters">["delayReason"]>;

type RoomStatusEncounter = Pick<
	Doc<"encounters">,
	| "_id"
	| "status"
	| "location"
	| "flowStage"
	| "flowOwner"
	| "delayReason"
	| "delayNote"
	| "assignedProvider"
	| "transportStatus"
	| "roomTurnoverStatus"
>;

const TOTAL_BEDS = 20;
const BED_OPTIONS = Array.from({ length: TOTAL_BEDS }, (_, index) => `Bed ${index + 1}`);

const FLOW_STAGE_OPTIONS: Array<{ value: RoomFlowStage; label: string; hint: string; delayReason: DelayReason }> = [
	{ value: "triage", label: "Triage", hint: "initial assessment", delayReason: "none" },
	{ value: "awaiting_bed", label: "Awaiting Bed", hint: "waiting for room placement", delayReason: "awaiting_bed" },
	{ value: "bedded", label: "Bedded", hint: "patient has a room", delayReason: "none" },
	{ value: "provider_assigned", label: "Provider Assigned", hint: "clinician now owns the case", delayReason: "none" },
	{ value: "workup_pending", label: "Workup Pending", hint: "labs / imaging in flight", delayReason: "awaiting_labs" },
	{ value: "consult_pending", label: "Consult Pending", hint: "specialty review pending", delayReason: "awaiting_consult" },
	{ value: "discharge_ready", label: "Discharge Ready", hint: "discharge checklist in motion", delayReason: "none" },
	{ value: "admit_ready", label: "Admit Ready", hint: "awaiting inpatient placement", delayReason: "awaiting_inpatient_bed" },
	{ value: "boarded", label: "Boarded", hint: "transport / transfer in progress", delayReason: "awaiting_transport" },
];

const FLOW_STAGE_BADGES: Record<RoomFlowStage, string> = {
	triage: "border-blue-200 bg-blue-50 text-blue-700",
	awaiting_bed: "border-amber-200 bg-amber-50 text-amber-700",
	bedded: "border-emerald-200 bg-emerald-50 text-emerald-700",
	provider_assigned: "border-cyan-200 bg-cyan-50 text-cyan-700",
	workup_pending: "border-violet-200 bg-violet-50 text-violet-700",
	consult_pending: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700",
	discharge_ready: "border-emerald-200 bg-emerald-50 text-emerald-700",
	admit_ready: "border-sky-200 bg-sky-50 text-sky-700",
	boarded: "border-rose-200 bg-rose-50 text-rose-700",
};

function normalizeBedLocation(location?: string): string {
	const trimmed = location?.trim() ?? "";
	if (!trimmed) return "";

	const match = /^bed\s+(\d+)$/i.exec(trimmed);
	if (!match) return trimmed;

	const bedNumber = Number(match[1]);
	if (!Number.isInteger(bedNumber) || bedNumber < 1 || bedNumber > TOTAL_BEDS) {
		return trimmed;
	}

	return `Bed ${bedNumber}`;
}

function getCurrentFlowStage(encounter: RoomStatusEncounter): RoomFlowStage {
	if (encounter.flowStage) return encounter.flowStage;

	switch (encounter.status) {
		case "triage":
			return "triage";
		case "waiting":
			return "awaiting_bed";
		case "treating":
			return encounter.location ? "bedded" : "awaiting_bed";
		case "observed":
			return "boarded";
		default:
			return "discharge_ready";
	}
}

export default function RoomStatus({ encounter }: { encounter: RoomStatusEncounter }) {
	const assignBed = useMutation(api.encounters.assignBed);
	const updateEncounterFlow = useMutation(api.encounters.updateEncounterFlow);
	const [selectedBed, setSelectedBed] = useState(normalizeBedLocation(encounter.location));
	const [flowOwner, setFlowOwner] = useState(encounter.flowOwner ?? "");
	const [savingBed, setSavingBed] = useState(false);
	const [savingStage, setSavingStage] = useState<RoomFlowStage | null>(null);

	const currentStage = useMemo(() => getCurrentFlowStage(encounter), [encounter]);

	useEffect(() => {
		setSelectedBed(normalizeBedLocation(encounter.location));
		setFlowOwner(encounter.flowOwner ?? "");
	}, [encounter.flowOwner, encounter.location]);

	const handleAssignBed = async () => {
		if (!selectedBed) {
			toast.error("Select a bed before assigning.");
			return;
		}

		setSavingBed(true);
		try {
			await assignBed({ encounterId: encounter._id, location: selectedBed });
			toast.success(`Assigned to ${selectedBed}.`);
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unable to assign bed.";
			toast.error(message);
		} finally {
			setSavingBed(false);
		}
	};

	const handleStageChange = async (stage: RoomFlowStage) => {
		setSavingStage(stage);
		try {
			const selectedStage = FLOW_STAGE_OPTIONS.find((option) => option.value === stage);
			await updateEncounterFlow({
				encounterId: encounter._id,
				flowStage: stage,
				flowOwner: flowOwner.trim() || undefined,
				delayReason: selectedStage?.delayReason,
			});
			toast.success(`Moved to ${selectedStage?.label ?? stage.replaceAll("_", " ")}.`);
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unable to update movement state.";
			toast.error(message);
		} finally {
			setSavingStage(null);
		}
	};

	const handleOwnerSave = async () => {
		setSavingStage(currentStage);
		try {
			await updateEncounterFlow({
				encounterId: encounter._id,
				flowOwner: flowOwner.trim() || undefined,
			});
			toast.success("Flow owner updated.");
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unable to update flow owner.";
			toast.error(message);
		} finally {
			setSavingStage(null);
		}
	};

	const currentLabel = FLOW_STAGE_OPTIONS.find((option) => option.value === currentStage)?.label ?? currentStage.replaceAll("_", " ");
	const currentHint = FLOW_STAGE_OPTIONS.find((option) => option.value === currentStage)?.hint ?? "Current movement state";

	return (
		<Card className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
			<CardHeader className="border-b border-slate-200 bg-slate-50/80 pb-4 dark:border-slate-800 dark:bg-slate-950/40">
				<CardTitle className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-slate-700 dark:text-slate-200">
					<Route className="h-4 w-4 text-blue-600" /> Movement & Room Assignment
				</CardTitle>
			</CardHeader>

			<CardContent className="space-y-4 p-4">
				<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
					<div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950/40">
						<p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Room</p>
						<p className="mt-1 text-sm font-black text-slate-900 dark:text-slate-100">{normalizeBedLocation(encounter.location) || "Unassigned"}</p>
					</div>
					<div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950/40">
						<p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Stage</p>
						<Badge className={`mt-1 border px-2 py-1 text-[9px] font-black uppercase tracking-widest ${FLOW_STAGE_BADGES[currentStage]}`}>
							{currentLabel}
						</Badge>
					</div>
					<div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950/40">
						<p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Owner</p>
						<p className="mt-1 truncate text-sm font-semibold text-slate-700 dark:text-slate-200">{encounter.flowOwner || "Unassigned"}</p>
					</div>
					<div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950/40">
						<p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Delay</p>
						<p className="mt-1 text-sm font-semibold text-slate-700 dark:text-slate-200">{encounter.delayReason?.replaceAll("_", " ") || "none"}</p>
					</div>
				</div>

				{(encounter.assignedProvider || encounter.transportStatus || encounter.roomTurnoverStatus) && (
					<div className="flex flex-wrap gap-2">
						{encounter.assignedProvider ? (
							<Badge variant="outline" className="border-slate-200 bg-slate-50 text-[9px] font-black uppercase tracking-widest text-slate-600">
								<UserRound className="mr-1 h-3 w-3" /> {encounter.assignedProvider}
							</Badge>
						) : null}
						{encounter.transportStatus ? (
							<Badge variant="outline" className="border-amber-200 bg-amber-50 text-[9px] font-black uppercase tracking-widest text-amber-700">
								<ArrowRightLeft className="mr-1 h-3 w-3" /> {encounter.transportStatus.replaceAll("_", " ")}
							</Badge>
						) : null}
						{encounter.roomTurnoverStatus ? (
							<Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-[9px] font-black uppercase tracking-widest text-emerald-700">
								<Sparkles className="mr-1 h-3 w-3" /> {encounter.roomTurnoverStatus.replaceAll("_", " ")}
							</Badge>
						) : null}
					</div>
				)}

				<div className="grid gap-3 md:grid-cols-[1fr_auto]">
					<div className="space-y-1.5">
						<Label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Assign Bed</Label>
						<Select value={selectedBed} onValueChange={setSelectedBed}>
							<SelectTrigger className="h-11 rounded-2xl border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950/50">
								<SelectValue placeholder="Choose a bed" />
							</SelectTrigger>
							<SelectContent>
								{BED_OPTIONS.map((bed) => (
									<SelectItem key={bed} value={bed}>
										{bed}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className="flex items-end">
						<Button
							type="button"
							className="h-11 rounded-2xl bg-blue-600 px-4 text-[10px] font-black uppercase tracking-widest text-white hover:bg-blue-500"
							onClick={() => void handleAssignBed()}
							disabled={savingBed}
						>
							<BedDouble className="mr-2 h-4 w-4" /> {savingBed ? "Assigning..." : "Assign Bed"}
						</Button>
					</div>
				</div>

				<div>
					<div className="mb-2 flex items-center justify-between gap-3">
						<p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Move Patient</p>
						<p className="text-[9px] font-semibold uppercase tracking-widest text-slate-400">{currentHint}</p>
					</div>
					<div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
						{FLOW_STAGE_OPTIONS.map((option) => (
							<Button
								key={option.value}
								type="button"
								variant={currentStage === option.value ? "default" : "outline"}
								className={`h-auto min-h-16 flex-col items-start rounded-2xl px-3 py-3 text-left text-[10px] font-black uppercase tracking-widest ${
									currentStage === option.value
										? "bg-slate-900 text-white hover:bg-slate-800"
										: "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-200"
								}`}
								onClick={() => void handleStageChange(option.value)}
								disabled={savingStage !== null}
							>
								<span className="flex w-full items-center justify-between gap-3">
									<span>{option.label}</span>
									{currentStage === option.value && <Badge className="border-0 bg-white/15 text-[8px] font-black uppercase tracking-widest text-white">Current</Badge>}
								</span>
								<span className={`mt-1 text-[9px] font-semibold uppercase tracking-normal ${currentStage === option.value ? "text-slate-300" : "text-slate-400"}`}>
									{option.hint}
								</span>
							</Button>
						))}
					</div>
				</div>

				<div className="grid gap-3 md:grid-cols-[1fr_auto]">
					<div className="space-y-1.5">
						<Label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Flow Owner</Label>
						<Input
							value={flowOwner}
							onChange={(event) => setFlowOwner(event.target.value)}
							placeholder="Assigned nurse, provider, or tech"
							className="h-11 rounded-2xl border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950/50"
						/>
					</div>
					<div className="flex items-end">
						<Button
							type="button"
							variant="outline"
							className="h-11 rounded-2xl border-slate-200 px-4 text-[10px] font-black uppercase tracking-widest"
							onClick={() => void handleOwnerSave()}
							disabled={savingStage !== null}
						>
							<MapPin className="mr-2 h-4 w-4" /> Save Owner
						</Button>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
