"use client";

import { useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Doc } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Edit2, Check, X, FileText, BookMarked, Download, Search, Clock3, Bookmark, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  extractKeyPoints,
  extractDefinitions,
  generateNoteSummary,
  formatNoteForExport,
  createTopicHierarchy,
  organizeTranscriptionByTopics,
} from "@/lib/helpers/academicAI";

interface NoteDetailViewProps {
  note: Omit<Doc<"studyNotes">, "topics"> & {
    topics?: Array<{ topic: string; frequency: number; context?: string }>;
    recordingMarkers?: Array<{ label: string; markerType?: "Exam" | "Definition" | "Formula" | "Action Item" | "General"; elapsedSeconds: number; createdAt: number }>;
    transcriptStats?: { totalSeconds: number; pauseSeconds: number; markerCount: number };
  };
  onClose: () => void;
  onDelete: () => void;
}

export default function NoteDetailView({
  note,
  onClose,
  onDelete,
}: NoteDetailViewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(note.content);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcriptSearch, setTranscriptSearch] = useState("");
  const [cleanupDraft, setCleanupDraft] = useState(editedContent || note.content);

  const updateContent = useMutation(api.academicScribe.updateStudyNoteContent);
  const updateSummary = useMutation(api.academicScribe.updateNoteSummary);
  const exportNote = useMutation(api.academicScribe.exportStudyNote);

  const keyPoints =
    note.keyPoints || extractKeyPoints(note.content || "");
  const definitions =
    note.definitions || extractDefinitions(note.content || "");
  const noteTopics = note.topics?.map((topic) => topic.topic) || [];
  const summary =
    note.summary ||
    generateNoteSummary(note.content || "", noteTopics);
  const hierarchy = createTopicHierarchy(noteTopics, note.subject);
  const cleanDraft = organizeTranscriptionByTopics(note.rawTranscription || note.content || "", noteTopics);
  const markerGroups = useMemo(() => {
    const groups = new Map<string, Array<{ label: string; markerType?: string; elapsedSeconds: number; createdAt: number }>>();
    (note.recordingMarkers ?? []).forEach((marker) => {
      const type = marker.markerType ?? "General";
      const existing = groups.get(type) ?? [];
      existing.push(marker);
      groups.set(type, existing);
    });
    return Array.from(groups.entries());
  }, [note.recordingMarkers]);

  const cleanupCandidates = useMemo(() => {
    const source = cleanupDraft || "";
    const candidates: Array<{ from: string; to: string; reason: string }> = [];
    const rules: Array<{ from: RegExp; replacement: string; reason: string }> = [
      { from: /\bdefinately\b/gi, replacement: "definitely", reason: "Common transcription misspelling" },
      { from: /\bteh\b/gi, replacement: "the", reason: "Keyboard/transcription typo" },
      { from: /\brecieve\b/gi, replacement: "receive", reason: "Common misspelling" },
      { from: /\buh+\b/gi, replacement: "", reason: "Filler term" },
      { from: /\bum+\b/gi, replacement: "", reason: "Filler term" },
      { from: /\binaudible\b/gi, replacement: "[review required]", reason: "Unclear audio token" },
    ];

    for (const rule of rules) {
      const match = source.match(rule.from);
      if (!match) continue;
      candidates.push({ from: match[0], to: rule.replacement, reason: rule.reason });
    }

    return candidates.slice(0, 10);
  }, [cleanupDraft]);

  const nextStudyPlan = useMemo(() => {
    const targets = keyPoints.slice(0, 3);
    const flashcards = definitions.slice(0, 5).map((item) => ({ front: item.term, back: item.definition }));
    const quiz = keyPoints.slice(0, 3).map((item, idx) => `Q${idx + 1}: Explain "${item}" in one sentence.`);
    const reminders = [1, 3, 7].map((day) => {
      const date = new Date();
      date.setDate(date.getDate() + day);
      return `${date.toLocaleDateString()} - ${day === 1 ? "Quick review" : day === 3 ? "Practice recall" : "Mini test"}`;
    });

    return { targets, flashcards, quiz, reminders };
  }, [definitions, keyPoints]);
  const transcriptLines = (editedContent || note.content || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const transcriptSearchTerm = transcriptSearch.trim().toLowerCase();
  const filteredTranscriptLines = transcriptSearchTerm
    ? transcriptLines.filter((line) => line.toLowerCase().includes(transcriptSearchTerm))
    : transcriptLines;

  const highlightText = (text: string) => {
    if (!transcriptSearchTerm) return text;
    const parts = text.split(new RegExp(`(${transcriptSearchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "i"));
    return parts.map((part, index) =>
      part.toLowerCase() === transcriptSearchTerm ? (
        <mark key={`${part}-${index}`} className="rounded bg-yellow-200 px-1 text-slate-900 dark:bg-yellow-500/40 dark:text-white">
          {part}
        </mark>
      ) : (
        <span key={`${part}-${index}`}>{part}</span>
      )
    );
  };

  const handleSaveEdit = async () => {
    try {
      setIsProcessing(true);
      await updateContent({
        noteId: note._id,
        content: editedContent,
        organizationStatus: "organized",
      });
      setCleanupDraft(editedContent);
      toast.success("Content saved");
      setIsEditing(false);
    } catch {
      toast.error("Failed to save content");
    } finally {
      setIsProcessing(false);
    }
  };

  const applyCleanupSuggestion = (from: string, to: string) => {
    if (!from) return;
    const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const next = cleanupDraft.replace(new RegExp(escaped, "gi"), to);
    setCleanupDraft(next);
    setEditedContent(next);
  };

  const applyCleanDraftToEditor = () => {
    setEditedContent(cleanDraft);
    setCleanupDraft(cleanDraft);
    toast.success("Clean draft copied to editor. Save to keep changes.");
  };

  const handleGenerateSummary = async () => {
    try {
      setIsProcessing(true);
      const newKeyPoints = extractKeyPoints(
        editedContent || note.content
      );
      const newDefinitions = extractDefinitions(
        editedContent || note.content
      );
      const newSummary = generateNoteSummary(editedContent || note.content, noteTopics);

      await updateSummary({
        noteId: note._id,
        summary: newSummary,
        keyPoints: newKeyPoints,
        definitions: newDefinitions,
      });

      toast.success("Summary generated");
    } catch {
      toast.error("Failed to generate summary");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExport = async (format: "markdown" | "txt") => {
    try {
      setIsProcessing(true);
      const exportedNote = {
        subject: note.subject,
        content: editedContent || note.content,
        topics: noteTopics,
        summary,
        keyPoints,
        definitions,
        createdAt: note.createdAt,
      };

      const formattedContent = formatNoteForExport(exportedNote, format);

      // Download file
      const blob = new Blob([formattedContent], {
        type: format === "markdown" ? "text/markdown" : "text/plain",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${note.subject}-${new Date(note.createdAt).toLocaleDateString()}.${format === "markdown" ? "md" : "txt"}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Track export
      await exportNote({
        noteId: note._id,
        format,
      });

      toast.success(`Exported as ${format.toUpperCase()}`);
    } catch {
      toast.error("Failed to export");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="mb-2">{note.subject}</CardTitle>
              <CardDescription>
                {new Date(note.createdAt).toLocaleString()} •{" "}
                {note.organizationStatus === "summarized"
                  ? "✓ Summarized"
                  : "Pending summary"}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={onClose}
              >
                <X className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={onDelete}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Main Tabs */}
      <Tabs defaultValue="content" className="w-full">
        <TabsList className="grid w-full grid-cols-2 gap-2 sm:grid-cols-6">
          <TabsTrigger value="content" className="gap-2">
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">Content</span>
          </TabsTrigger>
          <TabsTrigger value="transcript" className="gap-2">
            <Search className="w-4 h-4" />
            <span className="hidden sm:inline">Transcript</span>
          </TabsTrigger>
          <TabsTrigger value="summary" className="gap-2">
            <BookMarked className="w-4 h-4" />
            <span className="hidden sm:inline">Summary</span>
          </TabsTrigger>
          <TabsTrigger value="compare" className="gap-2">
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">Compare</span>
          </TabsTrigger>
          <TabsTrigger value="topics" className="gap-2">
            Topics ({note.topics?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="export" className="gap-2">
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export</span>
          </TabsTrigger>
        </TabsList>

        {/* Content Tab */}
        <TabsContent value="content" className="space-y-4">
          {isEditing ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Edit Content</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  className="min-h-96 font-mono text-sm"
                  placeholder="Edit your note content..."
                />
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setIsEditing(false)}
                    disabled={isProcessing}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSaveEdit}
                    disabled={isProcessing}
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Save Changes
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Transcription</CardTitle>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsEditing(true)}
                  >
                    <Edit2 className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="prose dark:prose-invert max-w-none">
                  <p className="whitespace-pre-wrap text-sm">
                    {editedContent || note.content}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Transcript Tab */}
        <TabsContent value="transcript" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-base">Search Transcript</CardTitle>
                  <CardDescription>Find phrases quickly inside the full recording text.</CardDescription>
                </div>
                <Input
                  value={transcriptSearch}
                  onChange={(event) => setTranscriptSearch(event.target.value)}
                  placeholder="Search transcript"
                  className="sm:max-w-xs"
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-7 dark:border-slate-800 dark:bg-slate-900">
                {filteredTranscriptLines.length > 0 ? (
                  filteredTranscriptLines.map((line, index) => (
                    <p key={`${index}-${line}`} className="mb-2 last:mb-0">
                      {highlightText(line)}
                    </p>
                  ))
                ) : (
                  <p className="text-slate-500">No transcript matches found.</p>
                )}
              </div>

              {note.recordingMarkers && note.recordingMarkers.length > 0 && (
                <Card className="border-dashed border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2"><Bookmark className="h-4 w-4" /> Recording Markers</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {markerGroups.map(([type, markers]) => (
                      <div key={type} className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{type}</p>
                        {markers.map((marker) => (
                          <div key={`${marker.createdAt}-${marker.elapsedSeconds}`} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-800">
                            <span className="font-medium">{marker.label}</span>
                            <Badge variant="secondary">{Math.floor(marker.elapsedSeconds / 60)}:{String(marker.elapsedSeconds % 60).padStart(2, "0")}</Badge>
                          </div>
                        ))}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compare" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Transcript vs Clean Notes</CardTitle>
                  <CardDescription>Compare raw transcript with organized clean draft.</CardDescription>
                </div>
                <Button onClick={applyCleanDraftToEditor} size="sm" variant="outline">Use Clean Draft</Button>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
                <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Raw Transcript</p>
                <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">{note.rawTranscription || note.content}</p>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 dark:border-emerald-900 dark:bg-emerald-950/30">
                <p className="mb-2 text-xs font-semibold uppercase text-emerald-700 dark:text-emerald-300">Clean Draft</p>
                <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">{cleanDraft}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Summary Tab */}
        <TabsContent value="summary" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Summary</CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleGenerateSummary}
                  disabled={isProcessing}
                >
                  <Edit2 className="w-4 h-4 mr-2" />
                  Regenerate
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {summary}
              </p>
            </CardContent>
          </Card>

          {/* Key Points */}
          {keyPoints.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Key Points</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                    {keyPoints.map((point: string, idx: number) => (
                    <li key={idx} className="flex gap-3 text-sm">
                      <span className="font-bold text-blue-600 shrink-0">
                        {idx + 1}.
                      </span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Definitions */}
          {definitions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Definitions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {definitions.map((def: { term: string; definition: string }, idx: number) => (
                  <div key={idx} className="pb-2 border-b last:border-b-0">
                    <p className="font-semibold text-sm">{def.term}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {def.definition}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {(note.transcriptStats || note.recordingMarkers?.length) && (
            <Card className="border-blue-200 bg-blue-50/60 dark:border-blue-900 dark:bg-blue-950/30">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Clock3 className="h-4 w-4" /> Session Analytics</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-3 text-sm">
                <div className="rounded-lg bg-white p-3 dark:bg-slate-900">
                  <p className="text-slate-500 text-xs uppercase">Duration</p>
                  <p className="font-semibold">{note.transcriptStats ? `${Math.floor(note.transcriptStats.totalSeconds / 60)} min` : "--"}</p>
                </div>
                <div className="rounded-lg bg-white p-3 dark:bg-slate-900">
                  <p className="text-slate-500 text-xs uppercase">Pause Time</p>
                  <p className="font-semibold">{note.transcriptStats ? `${Math.floor(note.transcriptStats.pauseSeconds / 60)} min` : "--"}</p>
                </div>
                <div className="rounded-lg bg-white p-3 dark:bg-slate-900">
                  <p className="text-slate-500 text-xs uppercase">Markers</p>
                  <p className="font-semibold">{note.transcriptStats?.markerCount ?? note.recordingMarkers?.length ?? 0}</p>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/30">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4" /> Result Highlights</CardTitle>
              <CardDescription>Quick takeaways to study first.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {keyPoints.slice(0, 5).map((point, idx) => (
                <div key={`${idx}-${point}`} className="rounded-lg bg-white p-3 dark:bg-slate-900">
                  <span className="mr-2 font-semibold text-emerald-700 dark:text-emerald-300">{idx + 1}.</span>
                  <span>{point}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/30">
            <CardHeader>
              <CardTitle className="text-base">Post-Class Cleanup Queue</CardTitle>
              <CardDescription>Quick fixes for likely transcription mistakes.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {cleanupCandidates.length > 0 ? cleanupCandidates.map((candidate, idx) => (
                <div key={`${candidate.from}-${idx}`} className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-white p-3 text-sm dark:border-amber-900 dark:bg-slate-900">
                  <p><span className="font-semibold">{candidate.from}</span> → <span className="font-semibold">{candidate.to || "(remove)"}</span></p>
                  <p className="text-xs text-slate-500">{candidate.reason}</p>
                  <Button size="sm" variant="outline" onClick={() => applyCleanupSuggestion(candidate.from, candidate.to)}>Apply</Button>
                </div>
              )) : (
                <p className="text-sm text-slate-500">No obvious cleanup items detected.</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-violet-200 bg-violet-50/60 dark:border-violet-900 dark:bg-violet-950/30">
            <CardHeader>
              <CardTitle className="text-base">Next Study Plan</CardTitle>
              <CardDescription>Auto-generated targets, flashcards, mini-quiz, and reminders.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase text-violet-700 dark:text-violet-300">Review Targets</p>
                {nextStudyPlan.targets.map((target, idx) => (
                  <p key={`${target}-${idx}`}>{idx + 1}. {target}</p>
                ))}
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold uppercase text-violet-700 dark:text-violet-300">Flashcards</p>
                {nextStudyPlan.flashcards.map((card, idx) => (
                  <p key={`${card.front}-${idx}`}>Q: {card.front} · A: {card.back}</p>
                ))}
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold uppercase text-violet-700 dark:text-violet-300">Mini Quiz</p>
                {nextStudyPlan.quiz.map((item) => (
                  <p key={item}>{item}</p>
                ))}
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold uppercase text-violet-700 dark:text-violet-300">Reminder Schedule</p>
                {nextStudyPlan.reminders.map((item) => (
                  <p key={item}>{item}</p>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Topics Tab */}
        <TabsContent value="topics" className="space-y-4">
          {hierarchy.length > 0 ? (
            hierarchy.map((group) => (
              <Card key={group.topic}>
                <CardHeader>
                  <CardTitle className="text-base">{group.topic}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {group.subtopics.map((subtopic, idx) => (
                      <Badge key={idx} variant="secondary">
                        {subtopic}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-slate-500 text-sm">
                  No topics identified
                </p>
              </CardContent>
            </Card>
          )}

          {/* Flat Topic List */}
          {note.topics && note.topics.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">All Topics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                    {noteTopics.map((topic: string, idx: number) => (
                    <Badge key={idx} variant="outline">
                      {topic}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Export Tab */}
        <TabsContent value="export" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Export Note</CardTitle>
              <CardDescription>
                Download your notes in different formats
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                onClick={() => handleExport("markdown")}
                className="w-full justify-start text-left"
                variant="outline"
                disabled={isProcessing}
              >
                <FileText className="w-4 h-4 mr-3" />
                <div>
                  <p className="font-medium">Markdown (.md)</p>
                  <p className="text-xs text-slate-500">
                    Best for Notion, Obsidian, or GitHub
                  </p>
                </div>
              </Button>
              <Button
                onClick={() => handleExport("txt")}
                className="w-full justify-start text-left"
                variant="outline"
                disabled={isProcessing}
              >
                <FileText className="w-4 h-4 mr-3" />
                <div>
                  <p className="font-medium">Plain Text (.txt)</p>
                  <p className="text-xs text-slate-500">
                    Universal format
                  </p>
                </div>
              </Button>
            </CardContent>
          </Card>

          {/* Export Info */}
          {note.exportedAt && (
            <Card className="bg-green-50 dark:bg-green-900 border-green-200">
              <CardContent className="pt-4">
                <p className="text-sm text-green-800 dark:text-green-200">
                  ✓ Last exported:{" "}
                  {new Date(note.exportedAt).toLocaleString()}
                  {note.exportFormat && ` as ${note.exportFormat.toUpperCase()}`}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
