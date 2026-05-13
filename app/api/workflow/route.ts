import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Workflow Automation API
 * Handles referrals, ADT events, bed turnover, discharge planning
 */

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const operation = searchParams.get("op");
  const encounterId = searchParams.get("encounterId");

  try {
    switch (operation) {
      case "get-referrals":
        return NextResponse.json({
          referrals: [
            {
              id: "ref-1",
              specialty: "cardiology",
              status: "pending",
              createdAt: new Date().toISOString(),
            },
          ],
        });

      case "get-adt-history":
        if (!encounterId) return NextResponse.json({ error: "Missing encounterId" }, { status: 400 });
        return NextResponse.json({
          adtEvents: [
            {
              id: "adt-1",
              eventType: "A01",
              eventName: "Admit",
              timestamp: new Date().toISOString(),
            },
          ],
        });

      case "get-workflow-status":
        if (!encounterId) return NextResponse.json({ error: "Missing encounterId" }, { status: 400 });
        return NextResponse.json({
          encounterId,
          adtEventCount: 2,
          pendingReferralCount: 1,
          completedReferralCount: 0,
          workflowPhase: "discharge_planning",
        });

      default:
        return NextResponse.json({ error: "Invalid operation" }, { status: 400 });
    }
  } catch (error) {
    console.error("Workflow API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch workflow data" },
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
      case "create-referral":
        return NextResponse.json({
          status: "created",
          referralId: `ref-${Date.now()}`,
          specialty: body.specialtyRequested,
          assignedProvider: "Dr. Smith",
        });

      case "accept-referral":
        return NextResponse.json({
          status: "accepted",
          referralId: body.referralId,
          acceptedAt: new Date().toISOString(),
          acceptedBy: "Dr. Smith",
        });

      case "complete-referral":
        return NextResponse.json({
          status: "completed",
          referralId: body.referralId,
          completedAt: new Date().toISOString(),
          completionNotes: body.completionNotes,
        });

      case "publish-adt":
        const eventType = body.eventType || "A01"; // A01=Admit, A03=Discharge, A02=Transfer
        return NextResponse.json({
          status: "published",
          eventId: `evt-${Date.now()}`,
          eventType,
          message: `ADT^${eventType} event published to Epic`,
          hl7Message: generateMockHL7(eventType),
        });

      case "trigger-bed-turnover":
        return NextResponse.json({
          status: "triggered",
          bedLabel: body.bedLabel,
          turnoverId: `turnover-${Date.now()}`,
          cleaningStatus: "queued",
        });

      case "auto-route-post-op":
        return NextResponse.json({
          status: "routed",
          targetUnit: body.acuity >= 2 ? "ICU" : "PACU",
          routedAt: new Date().toISOString(),
        });

      case "retry-adt":
        return NextResponse.json({
          status: "retry_queued",
          eventId: body.eventId,
          retryCount: body.retryCount || 1,
        });

      default:
        return NextResponse.json({ error: "Invalid operation" }, { status: 400 });
    }
  } catch (error) {
    console.error("Workflow POST error:", error);
    return NextResponse.json(
      { error: "Failed to process workflow request" },
      { status: 500 }
    );
  }
}

function generateMockHL7(eventType: string): string {
  const timestamp = new Date().toISOString().replace(/[-:T.]/g, "").split("Z")[0];
  return `MSH|^~\\&|TRIAGE|FACILITY|EPIC|EPICPRD|${timestamp}||ADT^${eventType}|MSG${timestamp}|P|2.5\nEVN|${eventType}|${timestamp}\nPID|1||12345^^^MRN~6789^^^PATID||DOE^JOHN`;
}
