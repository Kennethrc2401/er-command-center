import { NextResponse } from "next/server";

type Action = "rewrite" | "summarize" | "translate" | "patient_friendly";

type RequestBody = {
  action?: Action;
  input?: string;
  target?: "en" | "es";
};

function buildInstruction(action: Action, target?: "en" | "es"): string {
  if (action === "rewrite") {
    return "Rewrite the text for clinical clarity. Keep meaning unchanged. Return only rewritten text.";
  }

  if (action === "summarize") {
    return "Summarize the text in 3 concise sentences. Return only summary text.";
  }

  if (action === "patient_friendly") {
    return "Rewrite the text in patient-friendly language at roughly 6th grade reading level. Return only rewritten text.";
  }

  if (action === "translate") {
    return target === "es"
      ? "Translate the text to Spanish. Return only translated text."
      : "Translate the text to English. Return only translated text.";
  }

  return "Return the input text.";
}

export async function POST(request: Request) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not configured." }, { status: 503 });
  }

  try {
    const body = (await request.json()) as RequestBody;
    const action = body.action;
    const input = (body.input ?? "").trim();

    if (!action || !input) {
      return NextResponse.json({ error: "action and input are required." }, { status: 400 });
    }

    const instruction = buildInstruction(action, body.target);
    const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: "system",
            content: instruction,
          },
          {
            role: "user",
            content: input,
          },
        ],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json({ error: text || "AI provider request failed." }, { status: 502 });
    }

    const payload = (await response.json()) as { output_text?: string };
    const output = payload.output_text?.trim() || "";

    if (!output) {
      return NextResponse.json({ error: "No output from provider." }, { status: 502 });
    }

    return NextResponse.json({ output });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
