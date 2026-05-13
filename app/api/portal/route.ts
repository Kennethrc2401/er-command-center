import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Patient Portal & Messaging API
 * Handles message generation, delivery, preferences
 */

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const operation = searchParams.get("op");
  const patientId = searchParams.get("patientId");

  try {
    switch (operation) {
      case "get-preferences":
        if (!patientId) return NextResponse.json({ error: "Missing patientId" }, { status: 400 });
        return NextResponse.json({
          portalEnabled: true,
          smsOptIn: true,
          emailOptIn: true,
          preferredLanguage: "en",
        });

      case "get-messages":
        if (!patientId) return NextResponse.json({ error: "Missing patientId" }, { status: 400 });
        return NextResponse.json({
          messages: [
            {
              id: "msg-1",
              subject: "Your Discharge Summary",
              type: "discharge_summary",
              sentAt: new Date().toISOString(),
              viewedAt: null,
            },
            {
              id: "msg-2",
              subject: "Your Medication List",
              type: "medication_list",
              sentAt: new Date().toISOString(),
              viewedAt: new Date().toISOString(),
            },
          ],
        });

      case "get-delivery-status":
        return NextResponse.json({
          messageId: searchParams.get("messageId"),
          channels: [
            { channel: "email", status: "delivered", attemptedAt: new Date().toISOString() },
            { channel: "sms", status: "sent", attemptedAt: new Date().toISOString() },
          ],
        });

      default:
        return NextResponse.json({ error: "Invalid operation" }, { status: 400 });
    }
  } catch (error) {
    console.error("Portal API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch portal data" },
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
      case "send-message":
        // Send via SMS/Email/Portal
        return NextResponse.json({
          status: "sent",
          messageId: `msg-${Date.now()}`,
          channels: body.channels || ["portal"],
          message: "Message queued for delivery",
        });

      case "update-preferences":
        return NextResponse.json({
          status: "updated",
          preferences: body,
          message: "Communication preferences updated",
        });

      case "generate-discharge-summary":
        return NextResponse.json({
          status: "generated",
          messageId: `msg-${Date.now()}`,
          subject: "Your Discharge Summary",
          readyToSend: true,
        });

      case "generate-medication-list":
        return NextResponse.json({
          status: "generated",
          messageId: `msg-${Date.now()}`,
          medicationCount: body.medications?.length || 0,
        });

      case "mark-as-read":
        return NextResponse.json({
          status: "marked_read",
          messageId: body.messageId,
          readAt: new Date().toISOString(),
        });

      case "retry-delivery":
        return NextResponse.json({
          status: "retry_queued",
          deliveryEventId: body.deliveryEventId,
          retryCount: 1,
        });

      default:
        return NextResponse.json({ error: "Invalid operation" }, { status: 400 });
    }
  } catch (error) {
    console.error("Portal POST error:", error);
    return NextResponse.json(
      { error: "Failed to process portal request" },
      { status: 500 }
    );
  }
}
