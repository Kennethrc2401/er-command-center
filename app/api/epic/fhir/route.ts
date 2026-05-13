import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Epic FHIR API Integration Endpoint
 * Handles pull/push of patient data, CDS Hooks, and SMART on FHIR
 */

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const operation = searchParams.get("op");
  const epicMrn = searchParams.get("mrn");
  const resourceType = searchParams.get("resourceType");

  try {
    switch (operation) {
      case "get-patient":
        // Mock: In production, call Epic FHIR API
        return NextResponse.json({
          resourceType: "Patient",
          id: `epic-${epicMrn}`,
          name: [{ given: ["Test"], family: "Patient" }],
          dateOfBirth: "1980-01-01",
        });

      case "get-observations":
        // Mock: Return vital sign observations
        return NextResponse.json({
          resourceType: "Bundle",
          type: "searchset",
          entry: [
            {
              resource: {
                resourceType: "Observation",
                code: { coding: [{ code: "85354-9", display: "Blood Pressure" }] },
                valueQuantity: { value: 120, unit: "mmHg" },
              },
            },
          ],
        });

      case "get-medications":
        return NextResponse.json({
          resourceType: "Bundle",
          type: "searchset",
          entry: [
            {
              resource: {
                resourceType: "Medication",
                code: { coding: [{ code: "312612", display: "Lisinopril" }] },
              },
            },
          ],
        });

      case "get-conditions":
        return NextResponse.json({
          resourceType: "Bundle",
          type: "searchset",
          entry: [],
        });

      default:
        return NextResponse.json(
          { error: "Invalid operation" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Epic API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch from Epic" },
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
      case "push-disposition":
        // Mock: Push ADT event to Epic
        console.log("Pushing ADT to Epic:", body);
        return NextResponse.json({
          status: "sent",
          eventId: `evt-${Date.now()}`,
          message: "Disposition event queued for Epic",
        });

      case "submit-diagnosis":
        // Mock: Submit diagnosis codes
        return NextResponse.json({
          status: "accepted",
          message: "Diagnosis codes received by Epic",
        });

      case "sync-medication-list":
        return NextResponse.json({
          status: "synced",
          medicationsCount: body.medications?.length || 0,
        });

      default:
        return NextResponse.json(
          { error: "Invalid operation" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Epic API POST error:", error);
    return NextResponse.json(
      { error: "Failed to push to Epic" },
      { status: 500 }
    );
  }
}

// CDS Hooks endpoint for clinical decision support
export async function OPTIONS(request: NextRequest) {
  // CORS preflight
  return new NextResponse(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
