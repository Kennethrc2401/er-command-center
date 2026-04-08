"use client";

import { useState } from "react";
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
} from "@/lib/helpers/academicAI";

interface NoteDetailViewProps {
  note: Omit<Doc<"studyNotes">, "topics"> & {
    topics?: Array<{ topic: string; frequency: number; context?: string }>;
    recordingMarkers?: Array<{ label: string; elapsedSeconds: number; createdAt: number }>;
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
      toast.success("Content saved");
      setIsEditing(false);
    } catch {
      toast.error("Failed to save content");
    } finally {
      setIsProcessing(false);
    }
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
        <TabsList className="grid w-full grid-cols-2 gap-2 sm:grid-cols-5">
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
                    {note.recordingMarkers.map((marker) => (
                      <div key={`${marker.createdAt}-${marker.elapsedSeconds}`} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-800">
                        <span className="font-medium">{marker.label}</span>
                        <Badge variant="secondary">{Math.floor(marker.elapsedSeconds / 60)}:{String(marker.elapsedSeconds % 60).padStart(2, "0")}</Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
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
