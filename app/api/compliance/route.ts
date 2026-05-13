import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Compliance & Analytics API
 * Handles HEDIS metrics, clinical variance, coding audits, readmission risk
 */

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const operation = searchParams.get("op");

  try {
    switch (operation) {
      case "get-dashboard":
        return NextResponse.json({
          hedisComplianceRate: 82,
          clinicalVariancesCount: 5,
          highSeverityVariancesCount: 2,
          pendingAuditFindingsCount: 3,
          criticalFindingsCount: 1,
        });

      case "get-hedis-metrics":
        return NextResponse.json({
          period: "2026-Q2",
          complianceRate: 82,
          totalCases: 150,
          compliantCases: 123,
          nonCompliantCases: 20,
          notApplicableCases: 7,
        });

      case "get-variances":
        return NextResponse.json({
          variances: [
            {
              id: "var-1",
              type: "high_antibiotic_use",
              severity: "high",
              description: "Patient on antibiotics > 7 days without justification",
              createdAt: new Date().toISOString(),
            },
          ],
        });

      case "get-audits":
        return NextResponse.json({
          audits: [
            {
              id: "audit-1",
              type: "coding_compliance",
              findingsCount: 2,
              criticalIssues: 1,
              status: "requires_correction",
              createdAt: new Date().toISOString(),
            },
          ],
        });

      case "get-utilization":
        return NextResponse.json({
          procedures: [
            { cptCode: "99213", usage: 145, percentage: 25 },
            { cptCode: "99214", usage: 120, percentage: 21 },
            { cptCode: "71046", usage: 95, percentage: 16 },
          ],
        });

      case "get-readmission-risk":
        return NextResponse.json({
          patients: [
            {
              patientId: "p-1",
              riskScore: 65,
              riskTier: "high",
              dischargePlanQuality: "incomplete",
            },
          ],
        });

      default:
        return NextResponse.json({ error: "Invalid operation" }, { status: 400 });
    }
  } catch (error) {
    console.error("Compliance API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch compliance data" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const operation = searchParams.get("op");
  const body = await request.json();

  try {
    switch (operation) {
      case "capture-hedis-metric":
        return NextResponse.json({
          status: "captured",
          metricId: `metric-${Date.now()}`,
          measurementPeriod: body.measurementPeriod,
          complianceStatus: body.complianceStatus,
        });

      case "flag-variance":
        return NextResponse.json({
          status: "flagged",
          varianceId: `var-${Date.now()}`,
          varianceType: body.varianceType,
          severity: body.severity,
        });

      case "update-variance-analysis":
        return NextResponse.json({
          status: "updated",
          varianceId: body.varianceId,
          rootCauseAnalysis: body.rootCauseAnalysis,
          interventionPlan: body.interventionPlan,
        });

      case "resolve-variance":
        return NextResponse.json({
          status: "resolved",
          varianceId: body.varianceId,
          resolvedAt: new Date().toISOString(),
        });

      case "create-audit":
        return NextResponse.json({
          status: "created",
          auditId: `audit-${Date.now()}`,
          auditType: body.auditType,
          codesReviewedCount: (body.cptCodesReviewed?.length || 0) + (body.icdCodesReviewed?.length || 0),
          auditStatus: "in_progress",
        });

      case "review-audit":
        return NextResponse.json({
          status: "reviewed",
          auditId: body.auditId,
          reviewStatus: body.status,
          reviewedAt: new Date().toISOString(),
          reviewerName: body.reviewerName,
        });

      case "analyze-medication-variance":
        return NextResponse.json({
          antibioticUsageRate: 32,
          flagged: true,
          recommendations: ["Review antibiotic prescribing patterns", "Implement stewardship program"],
        });

      case "analyze-readmission-risk":
        return NextResponse.json({
          riskScore: 65,
          riskTier: "high",
          factors: ["incomplete discharge plan", "poor follow-up coordination"],
          recommendations: ["Improve discharge planning", "Schedule follow-up appointment"],
        });

      default:
        return NextResponse.json({ error: "Invalid operation" }, { status: 400 });
    }
  } catch (error) {
    console.error("Compliance POST error:", error);
    return NextResponse.json(
      { error: "Failed to process compliance request" },
      { status: 500 }
    );
  }
}
