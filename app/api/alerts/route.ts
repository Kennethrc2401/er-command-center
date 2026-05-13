import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Real-Time Alerts & Escalation API
 * Handles alert routing, acknowledgment, escalation, resolution
 */

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const operation = searchParams.get("op");

  try {
    switch (operation) {
      case "get-alerts":
        return NextResponse.json({
          alerts: [
            {
              id: "alert-1",
              type: "critical_lab",
              severity: "high",
              routedTo: "NURSE",
              createdAt: new Date().toISOString(),
              acknowledgedAt: null,
            },
          ],
        });

      case "get-metrics":
        return NextResponse.json({
          totalAlerts: 15,
          unacknowledgedCount: 3,
          escalatedCount: 1,
          resolvedCount: 11,
          avgTimeToAcknowledgeMin: 2.5,
        });

      case "get-config":
        return NextResponse.json({
          configurations: [
            {
              alertType: "critical_lab",
              enabled: true,
              routingRules: [
                { condition: "critical", targetRole: "NURSE", priority: "high" },
              ],
            },
          ],
        });

      case "get-escalation-history":
        return NextResponse.json({
          escalations: [
            {
              alertId: "alert-1",
              initialRoute: "NURSE",
              escalatedTo: "DOCTOR",
              escalatedAt: new Date().toISOString(),
              reason: "Not acknowledged within 5 minutes",
            },
          ],
        });

      default:
        return NextResponse.json({ error: "Invalid operation" }, { status: 400 });
    }
  } catch (error) {
    console.error("Alerts API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch alerts" },
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
      case "acknowledge":
        return NextResponse.json({
          status: "acknowledged",
          escalationId: body.escalationId,
          acknowledgedAt: new Date().toISOString(),
          acknowledgedBy: body.acknowledgedBy,
        });

      case "escalate":
        return NextResponse.json({
          status: "escalated",
          escalationId: body.escalationId,
          escalatedTo: body.escalateToRole,
          escalatedAt: new Date().toISOString(),
        });

      case "resolve":
        return NextResponse.json({
          status: "resolved",
          escalationId: body.escalationId,
          resolvedAt: new Date().toISOString(),
          resolutionDetails: body.resolutionDetails,
        });

      case "configure-alert":
        return NextResponse.json({
          status: "configured",
          alertType: body.alertType,
          routingRules: body.routingRules,
          isActive: body.isActive,
        });

      case "suppress":
        return NextResponse.json({
          status: "suppressed",
          suppressionKey: body.suppressionKey,
          suppressionWindow: body.suppressionWindowMinutes,
          expiresAt: new Date(Date.now() + body.suppressionWindowMinutes * 60000).toISOString(),
        });

      case "route-critical-lab":
        return NextResponse.json({
          status: "routed",
          alertId: `alert-${Date.now()}`,
          routedTo: "NURSE",
          escalationId: `esc-${Date.now()}`,
        });

      case "route-deterioration":
        return NextResponse.json({
          status: "routed",
          alertId: `alert-${Date.now()}`,
          routedTo: body.riskTier === "high" ? "DOCTOR" : "NURSE",
        });

      default:
        return NextResponse.json({ error: "Invalid operation" }, { status: 400 });
    }
  } catch (error) {
    console.error("Alerts POST error:", error);
    return NextResponse.json(
      { error: "Failed to process alert request" },
      { status: 500 }
    );
  }
}
