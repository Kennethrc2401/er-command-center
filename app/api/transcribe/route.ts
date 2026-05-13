import { NextResponse } from "next/server";

const TRANSCRIBE_MODEL = process.env.OPENAI_TRANSCRIBE_MODEL ?? "gpt-4o-mini-transcribe";

function mapLanguage(language: string | null) {
  if (!language) return undefined;
  const normalized = language.trim().toLowerCase();
  if (!normalized) return undefined;

  if (normalized.startsWith("en")) return "en";
  if (normalized.startsWith("es")) return "es";
  if (normalized.startsWith("fr")) return "fr";
  if (normalized.startsWith("de")) return "de";
  if (normalized.startsWith("it")) return "it";
  if (normalized.startsWith("pt")) return "pt";
  if (normalized.startsWith("ja")) return "ja";

  return undefined;
}

export async function POST(request: Request) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not configured." }, { status: 503 });
  }

  try {
    const body = await request.formData();
    const audio = body.get("audio");
    const language = mapLanguage((body.get("language") as string | null) ?? null);

    if (!(audio instanceof File)) {
      return NextResponse.json({ error: "audio file is required." }, { status: 400 });
    }

    if (audio.size === 0) {
      return NextResponse.json({ transcript: "" });
    }

    const payload = new FormData();
    payload.append("model", TRANSCRIBE_MODEL);
    payload.append("file", audio);
    payload.append("response_format", "json");
    if (language) {
      payload.append("language", language);
    }

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
      },
      body: payload,
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json({ error: text || "Audio transcription request failed." }, { status: 502 });
    }

    const json = (await response.json()) as { text?: string };
    const transcript = (json.text ?? "").trim();

    return NextResponse.json({ transcript });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
