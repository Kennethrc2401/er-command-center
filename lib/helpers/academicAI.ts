/**
 * Academic AI Scribe Helpers
 * Deterministic helpers for organizing study notes
 * (No external LLM calls - all client-side processing)
 */

/**
 * Extract potential topics from transcription using keywords
 * Groups related concepts together
 */
export function extractTopicsFromTranscription(
  transcription: string,
  subject: string
): {
  topics: string[];
  definitions: Array<{ term: string; context: string }>;
  keyPhrases: string[];
} {
  const subjectKeywords: Record<string, Record<string, RegExp>> = {
    "Calculus": {
      "derivatives": /\b(derivative|differentiation|chain rule|product rule|quotient rule|rate of change)\b/gi,
      "integrals": /\b(integral|integration|antiderivative|integration by parts|u-substitution)\b/gi,
      "limits": /\b(limit|continuity|epsilon-delta|infinity)\b/gi,
      "series": /\b(series|convergence|divergence|taylor series|fourier|harmonic)\b/gi,
      "functions": /\b(function|domain|range|asymptote|polynomial)\b/gi,
    },
    "Quantum Mechanics": {
      "wave functions": /\b(wave function|superposition|collapse|eigenstate|normalization)\b/gi,
      "operators": /\b(operator|hamiltonian|momentum operator|laplacian|observable)\b/gi,
      "energy levels": /\b(energy level|quantization|ground state|excited state|spectral line)\b/gi,
      "uncertainty principle": /\b(uncertainty|uncertainty principle|heisenberg|commutator)\b/gi,
      "fermions & bosons": /\b(fermion|boson|spin|pauli exclusion|symmetry)\b/gi,
    },
    "Data Structures": {
      "arrays": /\b(array|list|vector|static allocation|dynamic allocation)\b/gi,
      "linked lists": /\b(linked list|node|pointer|singly linked|doubly linked|circular)\b/gi,
      "stacks & queues": /\b(stack|queue|lifo|fifo|push|pop|enqueue|dequeue)\b/gi,
      "trees": /\b(tree|binary tree|bst|avl|red-black|heap|traversal|dfs|bfs)\b/gi,
      "graphs": /\b(graph|node|edge|adjacency|directed|undirected|weighted|dijkstra|dfs|bfs)\b/gi,
      "hash tables": /\b(hash table|hash function|collision|chaining|open addressing|load factor)\b/gi,
    },
    "Biology": {
      "cells": /\b(cell|nucleus|mitochondria|ribosome|organelle|membrane|cytoplasm)\b/gi,
      "genetics": /\b(gene|dna|rna|chromosome|allele|dominant|recessive|meiosis|mitosis)\b/gi,
      "metabolism": /\b(metabolism|glycolysis|krebs cycle|photosynthesis|atp|enzyme)\b/gi,
      "evolution": /\b(evolution|natural selection|adaptation|mutation|speciation|darwinian)\b/gi,
    },
    "Chemistry": {
      "atomic structure": /\b(atom|electron|proton|neutron|orbital|shell|subshell|valence)\b/gi,
      "bonding": /\b(bond|ionic|covalent|metallic|hydrogen bond|electronegativity)\b/gi,
      "reactions": /\b(reaction|acid|base|pH|oxidation|reduction|catalyst|equilibrium)\b/gi,
      "thermodynamics": /\b(entropy|enthalpy|free energy|equilibrium constant)\b/gi,
    },
  };

  const keywords = subjectKeywords[subject] || subjectKeywords["Data Structures"];
  const found: Map<string, number> = new Map();
  const definitions: Array<{ term: string; context: string }> = [];

  // Find matching keywords
  for (const [topic, regex] of Object.entries(keywords)) {
    const matches = (transcription.match(regex) || []).length;
    if (matches > 0) {
      found.set(topic, matches);
      // Extract context around first match
      const match = transcription.match(regex);
      if (match) {
        const idx = transcription.toLowerCase().indexOf(match[0].toLowerCase());
        const start = Math.max(0, idx - 50);
        const end = Math.min(transcription.length, idx + 100);
        const context = transcription.substring(start, end).trim();
        definitions.push({
          term: topic,
          context: context.length > 0 ? context : match[0],
        });
      }
    }
  }

  return {
    topics: Array.from(found.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([topic]) => topic),
    definitions,
    keyPhrases: Array.from(found.keys()),
  };
}

/**
 * Organize transcription into structured sections
 * Groups by natural breaks and topic transitions
 */
export function organizeTranscriptionByTopics(
  rawTranscription: string,
  extractedTopics: string[]
): string {
  let organized = rawTranscription;

  // Add section markers for extracted topics
  for (const topic of extractedTopics) {
    const regex = new RegExp(`\\b${topic}\\b`, "gi");
    organized = organized.replace(
      regex,
      (match) => `\n\n**${match}**\n`
    );
  }

  // Clean up multiple line breaks
  organized = organized.replace(/\n\n+/g, "\n\n");

  // Add punctuation where missing (very basic heuristic)
  organized = organized
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.endsWith(".") && !trimmed.endsWith("?") && !trimmed.endsWith("!") && trimmed.length > 20) {
        return trimmed + ".";
      }
      return trimmed;
    })
    .filter((line) => line.length > 0)
    .join("\n");

  return organized;
}

/**
 * Extract key points from organized transcription
 * Identifies main concepts and important statements
 */
export function extractKeyPoints(content: string): string[] {
  const sentences = content
    .split(/[\.\?\!]+/)
    .map((s) => s.trim())
    .filter(
      (s) =>
        s.length > 20 &&
        !s.startsWith("um ") &&
        !s.startsWith("uh ") &&
        !s.startsWith("like ") &&
        !s.startsWith("you know")
    );

  // Prioritize sentences with keywords
  const keywordPatterns = /important|key|crucial|remember|definition|means|is|represents|equals/i;
  const keyPoints = sentences
    .filter((s) => keywordPatterns.test(s))
    .slice(0, 5);

  // If not enough key points, add longest sentences
  if (keyPoints.length < 5) {
    const remaining = sentences
      .filter((s) => !keyPoints.includes(s))
      .sort((a, b) => b.length - a.length)
      .slice(0, 5 - keyPoints.length);
    keyPoints.push(...remaining);
  }

  return keyPoints.slice(0, 7);
}

/**
 * Generate a summary by extracting topic sentences
 */
export function generateNoteSummary(
  content: string,
  topics: string[]
): string {
  const lines = content.split("\n").filter((l) => l.trim().length > 0);

  // Find lines that mention topics
  const topicLines = lines.filter((line) =>
    topics.some((topic) => line.toLowerCase().includes(topic.toLowerCase()))
  );

  const summary =
    topicLines.slice(0, 3).join(" ") ||
    lines.slice(0, 3).join(" ") ||
    content.substring(0, 200);

  return summary.length > 0
    ? summary.substring(0, 500) + (summary.length > 500 ? "..." : "")
    : "Study note from class";
}

/**
 * Extract definitions from content
 * Looks for patterns like "X is..." or "X means..."
 */
export function extractDefinitions(
  content: string
): Array<{ term: string; definition: string }> {
  const definitionPatterns = [
    /(\w+(?:\s+\w+)?)\s+(?:is|means|refers to|denotes)\s+([^\.]+)/gi,
    /(\w+(?:\s+\w+)?)\s*[:=]\s*([^\.]+)/gi,
  ];

  const definitions: Array<{ term: string; definition: string }> = [];
  const seen = new Set<string>();

  for (const pattern of definitionPatterns) {
    let match;
    while ((match = pattern.exec(content))) {
      const term = match[1].trim();
      const def = match[2].trim();
      if (
        term.length > 2 &&
        def.length > 5 &&
        def.length < 200 &&
        !seen.has(term.toLowerCase())
      ) {
        definitions.push({ term, definition: def });
        seen.add(term.toLowerCase());
      }
    }
  }

  return definitions.slice(0, 10);
}

/**
 * Organize topics hierarchically by relationship
 */
export function createTopicHierarchy(
  topics: string[],
  subject: string
): Array<{ topic: string; subtopics: string[] }> {
  const hierarchy: Record<string, Record<string, string[]>> = {
    "Calculus": {
      "Fundamentals": ["limits", "continuity", "functions"],
      "Differentiation": ["derivatives", "chain rule", "product rule"],
      "Integration": ["integrals", "antiderivative", "integration by parts"],
      "Analysis": ["series", "convergence"],
    },
    "Data Structures": {
      "Linear": ["arrays", "linked lists", "stacks & queues"],
      "Non-linear": ["trees", "graphs"],
      "Hash": ["hash tables"],
    },
    "Quantum Mechanics": {
      "Foundations": ["wave functions", "uncertainty principle"],
      "Operators": ["operators", "observables"],
      "Atomic": ["energy levels", "spectral line"],
    },
  };

  const subjectHierarchy = hierarchy[subject] || {};
  const result: Array<{ topic: string; subtopics: string[] }> = [];

  for (const [category, subtopics] of Object.entries(subjectHierarchy)) {
    const matching = subtopics.filter((sub) =>
      topics.some((t) => t.toLowerCase().includes(sub.toLowerCase()))
    );
    if (matching.length > 0) {
      result.push({ topic: category, subtopics: matching });
    }
  }

  return result;
}

/**
 * Generate study session metadata: duration, word count, topic distribution
 */
export function generateSessionMetadata(
  content: string,
  durationMinutes: number,
  topics: string[]
) {
  const wordCount = content.split(/\s+/).length;
  const wordsPerMinute = Math.round(wordCount / Math.max(1, durationMinutes));

  return {
    wordCount,
    durationMinutes,
    averageWordsPerMinute: wordsPerMinute,
    topicCount: topics.length,
    estimatedReadingTime: Math.ceil(wordCount / 200), // ~200 wpm avg reading speed
    contentDensity: Math.round((wordCount / (durationMinutes * 60)) * 100) / 100, // words per second
  };
}

/**
 * Format note for export (Markdown or Plain Text)
 */
export function formatNoteForExport(
  note: {
    subject: string;
    content: string;
    topics: string[];
    summary?: string;
    keyPoints?: string[];
    definitions?: Array<{ term: string; definition: string }>;
    createdAt: number;
  },
  format: "markdown" | "txt"
): string {
  const dateStr = new Date(note.createdAt).toLocaleDateString();

  if (format === "markdown") {
    let md = `# ${note.subject}\n\n`;
    md += `*Generated: ${dateStr}*\n\n`;

    if (note.summary) {
      md += `## Summary\n\n${note.summary}\n\n`;
    }

    md += `## Topics\n\n`;
    md += note.topics.map((t) => `- ${t}`).join("\n");
    md += "\n\n";

    if (note.keyPoints && note.keyPoints.length > 0) {
      md += `## Key Points\n\n`;
      md += note.keyPoints.map((p) => `- ${p}`).join("\n");
      md += "\n\n";
    }

    if (note.definitions && note.definitions.length > 0) {
      md += `## Definitions\n\n`;
      md += note.definitions
        .map((d) => `**${d.term}**: ${d.definition}`)
        .join("\n\n");
      md += "\n\n";
    }

    md += `## Full Content\n\n${note.content}`;
    return md;
  }

  // Plain text format
  let txt = `${note.subject.toUpperCase()}\n`;
  txt += `${"=".repeat(note.subject.length)}\n\n`;
  txt += `Date: ${dateStr}\n\n`;

    if (note.summary) {
      txt += `SUMMARY:\n${note.summary}\n\n`;
    }

    txt += `TOPICS:\n`;
    txt += note.topics.map((t) => `- ${t}`).join("\n");
    txt += "\n\n";

    if (note.keyPoints && note.keyPoints.length > 0) {
      txt += `KEY POINTS:\n`;
      txt += note.keyPoints.map((p) => `- ${p}`).join("\n");
      txt += "\n\n";
    }

    if (note.definitions && note.definitions.length > 0) {
      txt += `DEFINITIONS:\n`;
      txt += note.definitions
        .map((d) => `${d.term}: ${d.definition}`)
        .join("\n\n");
      txt += "\n\n";
    }

    txt += `FULL CONTENT:\n${note.content}`;
    return txt;
}
