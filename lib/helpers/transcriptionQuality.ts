export type TranscriptionDomain = "general" | "clinical";

export type TranscriptQualitySegment = {
  text: string;
  confidence: number;
  issues: string[];
};

export type TranscriptQualitySummary = {
  normalizedText: string;
  averageConfidence: number;
  lowConfidenceSegments: TranscriptQualitySegment[];
  segmentCount: number;
};

export type TranscriptHighlightPart = {
  text: string;
  flagged?: TranscriptQualitySegment;
};

const FILLER_WORDS = [
  "um",
  "uh",
  "you know",
  "like",
  "sort of",
  "kind of",
  "i mean",
] as const;

const CLINICAL_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bo two\b/gi, "O2"],
  [/\bsat(?:uration)?\b/gi, "SpO2"],
  [/\bb p\b/gi, "BP"],
  [/\bheart rate\b/gi, "HR"],
  [/\bresp(?:iratory)? rate\b/gi, "RR"],
  [/\belectro cardiogram\b/gi, "electrocardiogram"],
  [/\bekg\b/gi, "ECG"],
  [/\bcat scan\b/gi, "CT scan"],
  [/\bmy oh cardial\b/gi, "myocardial"],
  [/\bdyspnea\b/gi, "dyspnea"],
  [/\bsepsis bundle\b/gi, "sepsis bundle"],
  [/\bq r s\b/gi, "QRS"],
];

function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function stripFillerWords(input: string) {
  let next = input;
  for (const filler of FILLER_WORDS) {
    const pattern = new RegExp(`\\b${filler.replace(/\\s+/g, "\\\\s+")}\\b`, "gi");
    next = next.replace(pattern, " ");
  }
  return next;
}

function normalizeSpacing(input: string) {
  return input
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;!?])/g, "$1")
    .replace(/([,.;!?])(\w)/g, "$1 $2")
    .trim();
}

function collapseRepeatedWords(input: string) {
  const words = input.split(/\s+/).filter(Boolean);
  if (words.length < 3) {
    return input;
  }

  const deduped: string[] = [];
  for (const word of words) {
    const prev = deduped[deduped.length - 1];
    if (prev && prev.toLowerCase() === word.toLowerCase()) {
      continue;
    }
    deduped.push(word);
  }

  return deduped.join(" ");
}

function applyClinicalCorrections(input: string) {
  let next = input;
  for (const [pattern, replacement] of CLINICAL_REPLACEMENTS) {
    next = next.replace(pattern, replacement);
  }
  return next;
}

function splitIntoSegments(input: string) {
  const sentenceSegments = input
    .split(/(?<=[.!?])\s+/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (sentenceSegments.length > 0) {
    return sentenceSegments;
  }

  const words = input.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += 14) {
    chunks.push(words.slice(i, i + 14).join(" "));
  }
  return chunks;
}

function scoreSegment(segment: string): TranscriptQualitySegment {
  const issues: string[] = [];
  const tokens = segment.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return { text: segment, confidence: 0, issues: ["empty"] };
  }

  let score = 0.95;

  const suspiciousTokens = tokens.filter((token) => /[^a-zA-Z0-9%.,:/+-]/.test(token));
  if (suspiciousTokens.length > 0) {
    score -= Math.min(0.2, suspiciousTokens.length * 0.04);
    issues.push("special characters");
  }

  const shortTokenRatio = tokens.filter((token) => token.length <= 2).length / tokens.length;
  if (tokens.length > 6 && shortTokenRatio > 0.45) {
    score -= 0.16;
    issues.push("too many short words");
  }

  const fillerHits = FILLER_WORDS.reduce((count, filler) => {
    const pattern = new RegExp(`\\b${filler.replace(/\\s+/g, "\\\\s+")}\\b`, "gi");
    return count + (segment.match(pattern)?.length ?? 0);
  }, 0);
  const fillerRatio = fillerHits / tokens.length;
  if (fillerRatio > 0.12) {
    score -= 0.18;
    issues.push("filler-heavy");
  }

  if (tokens.length > 10 && !/[.!?]$/.test(segment)) {
    score -= 0.08;
    issues.push("missing sentence boundary");
  }

  const uniqueRatio = new Set(tokens.map((token) => token.toLowerCase())).size / tokens.length;
  if (tokens.length >= 8 && uniqueRatio < 0.55) {
    score -= 0.15;
    issues.push("repetition");
  }

  const confidence = clamp(Number(score.toFixed(2)));
  return { text: segment, confidence, issues };
}

function getOverlapWordCount(previousWords: string[], incomingWords: string[]) {
  const maxOverlap = Math.min(12, previousWords.length, incomingWords.length);
  for (let overlap = maxOverlap; overlap >= 4; overlap -= 1) {
    const prevTail = previousWords.slice(-overlap).join(" ").toLowerCase();
    const incomingHead = incomingWords.slice(0, overlap).join(" ").toLowerCase();
    if (prevTail === incomingHead) {
      return overlap;
    }
  }
  return 0;
}

export function mergeTranscriptFragment(currentText: string, incomingFragment: string) {
  const base = normalizeSpacing(currentText);
  const incoming = normalizeSpacing(incomingFragment);

  if (!incoming) {
    return base;
  }
  if (!base) {
    return incoming;
  }

  const previousWords = base.split(/\s+/).filter(Boolean);
  const incomingWords = incoming.split(/\s+/).filter(Boolean);
  const overlap = getOverlapWordCount(previousWords, incomingWords);

  const mergedWords = overlap > 0
    ? [...previousWords, ...incomingWords.slice(overlap)]
    : [...previousWords, ...incomingWords];

  return normalizeSpacing(mergedWords.join(" "));
}

export function normalizeTranscriptText(
  input: string,
  options?: { domain?: TranscriptionDomain; customVocabulary?: string[] }
) {
  const domain = options?.domain ?? "general";
  const customVocabulary = (options?.customVocabulary ?? []).map((phrase) => phrase.trim()).filter(Boolean);

  let normalized = input;
  normalized = stripFillerWords(normalized);
  normalized = collapseRepeatedWords(normalized);
  normalized = normalizeSpacing(normalized);

  if (domain === "clinical") {
    normalized = applyClinicalCorrections(normalized);
  }

  // Preserve custom vocabulary terms by normalizing spacing around exact phrase matches.
  for (const phrase of customVocabulary) {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(escaped, "gi");
    normalized = normalized.replace(pattern, phrase);
  }

  return normalizeSpacing(normalized);
}

export function summarizeTranscriptQuality(
  transcript: string,
  options?: { domain?: TranscriptionDomain; customVocabulary?: string[] }
): TranscriptQualitySummary {
  const normalizedText = normalizeTranscriptText(transcript, options);
  const segments = splitIntoSegments(normalizedText).map(scoreSegment);

  const averageConfidence = segments.length === 0
    ? 0
    : Number((segments.reduce((sum, segment) => sum + segment.confidence, 0) / segments.length).toFixed(2));

  const lowConfidenceSegments = segments
    .filter((segment) => segment.confidence < 0.72)
    .sort((a, b) => a.confidence - b.confidence)
    .slice(0, 5);

  return {
    normalizedText,
    averageConfidence,
    lowConfidenceSegments,
    segmentCount: segments.length,
  };
}

function indexOfIgnoreCase(haystack: string, needle: string) {
  return haystack.toLowerCase().indexOf(needle.toLowerCase());
}

/**
 * Splits transcript text into flagged and unflagged segments for UI heatmap rendering.
 * Each low-confidence segment is highlighted at most once to avoid noisy duplicate markers.
 */
export function splitTranscriptForHighlights(
  transcript: string,
  lowConfidenceSegments: TranscriptQualitySegment[],
  maxHighlights = 20
): TranscriptHighlightPart[] {
  if (!transcript.trim() || lowConfidenceSegments.length === 0) {
    return [{ text: transcript }];
  }

  let parts: TranscriptHighlightPart[] = [{ text: transcript }];
  const candidates = lowConfidenceSegments
    .map((segment) => ({ ...segment, text: segment.text.trim() }))
    .filter((segment) => segment.text.length > 2)
    .slice(0, maxHighlights);

  for (const segment of candidates) {
    const nextParts: TranscriptHighlightPart[] = [];
    let consumed = false;

    for (const part of parts) {
      if (consumed || part.flagged) {
        nextParts.push(part);
        continue;
      }

      const matchIndex = indexOfIgnoreCase(part.text, segment.text);
      if (matchIndex === -1) {
        nextParts.push(part);
        continue;
      }

      const before = part.text.slice(0, matchIndex);
      const match = part.text.slice(matchIndex, matchIndex + segment.text.length);
      const after = part.text.slice(matchIndex + segment.text.length);

      if (before) nextParts.push({ text: before });
      nextParts.push({ text: match, flagged: segment });
      if (after) nextParts.push({ text: after });

      consumed = true;
    }

    parts = nextParts;
  }

  return parts;
}
