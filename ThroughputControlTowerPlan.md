# Throughput Control Tower Plan

## Objective

Add a disposition and throughput layer on top of the existing triage board so staff can see:

- where each encounter sits in the ED visit,
- who currently owns the next action,
- what is blocking movement,
- how the unit is performing on door-to-bed, provider-to-decision, discharge lag, and boarding time.

## Implemented In This Slice

- Added encounter flow fields in Convex for flow stage, flow owner, disposition plan, delay reason, and key operational timestamps.
- Added derived throughput queries for a live control tower board and shift-window throughput metrics.
- Added a mutation to update encounter flow state without creating a separate shadow model.
- Added a triage dashboard control tower panel with per-encounter ownership, stage, and delay controls.
- Replaced the insurance verification placeholder with a real mutation that updates insurance status for the active encounter.

## Data Model

The encounter record now carries the core throughput state:

- `flowStage`
- `flowOwner`
- `dispositionPlan`
- `delayReason`
- `delayNote`
- `bedAssignedAt`
- `providerAssignedAt`
- `dispositionDecisionAt`
- `readyForDischargeAt`
- `readyForAdmissionAt`

This keeps the first slice small and queryable without introducing a second operational workflow table.

## Roadmap

### Phase 1: Control Tower Foundation

- Live board grouped by front door, workup, disposition, and blocked states.
- Shift-window throughput metrics.
- Named ownership and blocker tracking.

### Phase 2: Closed-Loop Acknowledgements

- Route critical labs, imaging results, and consult callbacks into explicit owner acknowledgements.
- Track who accepted the alert and how long it stayed unacknowledged.

### Phase 3: Boarding And Transfer Workflow

- Admit acceptance timestamp.
- Inpatient bed request and assignment state.
- Transport status and handoff completion.
- Room turnover and discharge-complete checkpoints.

### Phase 4: Administrative Closure

- Full insurance verification loop with task aging and authorization tracking.
- Outbound fax composer linked to chart documents and discharge packets.
- Delay analytics by payer, shift, and destination service.