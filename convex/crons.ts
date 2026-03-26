import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "chart_documents_global_retention_sweep",
  { hours: 1 },
  internal.chartDocuments.runGlobalRetentionSweep,
  {
    actorName: "SYSTEM_RETENTION_JOB",
    actorRole: "ADMIN",
  }
);

crons.interval(
  "critical_lab_escalation_sweep",
  { minutes: 1 },
  internal.labs.runCriticalLabEscalations,
  {}
);

export default crons;
