"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useUser } from "@clerk/nextjs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, BookOpen, Mic, MessageCircle, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import RecordingInterface from "../../../components/study-notes/RecordingInterface";
import SessionTimeline from "../../../components/study-notes/SessionTimeline";
import TopicBrowser from "../../../components/study-notes/TopicBrowser";
import NoteDetailView from "../../../components/study-notes/NoteDetailView";
import StudyToolsPanel from "../../../components/study-notes/StudyToolsPanel";

const DEFAULT_SUBJECTS = [
  "Calculus",
  "Algebra",
  "Geometry",
  "Statistics",
  "Physics",
  "Chemistry",
  "Biology",
  "Anatomy",
  "Physiology",
  "Pharmacology",
  "Internal Medicine",
  "OB/GYN",
  "Pediatrics",
  "Emergency Medicine",
  "Nursing",
  "Psychology",
  "Computer Science",
  "Data Structures",
  "Algorithms",
  "Databases",
  "Software Engineering",
  "Engineering",
  "Mechanical Engineering",
  "Electrical Engineering",
  "Civil Engineering",
  "Economics",
  "Finance",
  "Accounting",
  "Marketing",
  "History",
  "English",
  "Law",
  "Political Science",
  "Philosophy",
  "Art",
  "Music",
  "Language Learning",
  "Research Methods",
  "Project Management",
];

const CUSTOM_SUBJECTS_STORAGE_KEY = "study-notes-custom-subjects";

const normalizeTopicName = (value: string) => value.trim().replace(/\s+/g, " ");

const getTopicKey = (value: string) => normalizeTopicName(value).toLowerCase();

const dedupeTopics = (topics: string[]) => {
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const rawTopic of topics) {
    const topic = normalizeTopicName(rawTopic);
    if (!topic) continue;
    const key = getTopicKey(topic);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(topic);
  }

  return deduped;
};

export default function StudyNotesPage() {
  const { user } = useUser();
  const userEmail = user?.primaryEmailAddress?.emailAddress;
  const appUser = useQuery(
    api.users.getByEmail,
    userEmail
      ? {
          email: userEmail,
        }
      : "skip"
  );
  const convexUserId = appUser?._id;
  const [activeTab, setActiveTab] = useState<"record" | "timeline" | "topics" | "notebook" | "tools">("record");
  const [selectedSubject, setSelectedSubject] = useState("Calculus");
  const [topicSearchTerm, setTopicSearchTerm] = useState("");
  const [customSubjects, setCustomSubjects] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(CUSTOM_SUBJECTS_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [];
      const normalized = parsed
        .filter((item): item is string => typeof item === "string")
        .map((item) => normalizeTopicName(item))
        .filter(Boolean);
      return dedupeTopics(normalized);
    } catch {
      return [];
    }
  });
  const [newTopicName, setNewTopicName] = useState("");
  const [isAddingTopic, setIsAddingTopic] = useState(false);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const deduped = dedupeTopics(customSubjects);
    window.localStorage.setItem(CUSTOM_SUBJECTS_STORAGE_KEY, JSON.stringify(deduped));
  }, [customSubjects]);

  const allSubjects = useMemo(() => {
    return dedupeTopics([...DEFAULT_SUBJECTS, ...customSubjects]);
  }, [customSubjects]);

  const searchQuery = topicSearchTerm.trim();

  const filteredSubjects = useMemo(() => {
    const query = searchQuery.toLowerCase();
    if (!query) return allSubjects;
    return allSubjects.filter((subject) => subject.toLowerCase().includes(query));
  }, [allSubjects, searchQuery]);

  const exactMatchSubject = useMemo(() => {
    const query = searchQuery.toLowerCase();
    if (!query) return null;
    return allSubjects.find((subject) => subject.toLowerCase() === query) ?? null;
  }, [allSubjects, searchQuery]);

  // Queries
  const notesBySubject = useQuery(
    api.academicScribe.getNotesBySubject,
    selectedSubject && convexUserId
      ? {
          userId: convexUserId,
          subject: selectedSubject,
        }
      : "skip"
  );

  const selectedNote = useQuery(
    api.academicScribe.getStudyNoteDetail,
    selectedNoteId ? { noteId: selectedNoteId as Id<"studyNotes"> } : "skip"
  );

  const topicIndex = useQuery(
    api.academicScribe.getTopicIndex,
    selectedSubject && convexUserId
      ? {
          userId: convexUserId,
          subject: selectedSubject,
        }
      : "skip"
  );

  const deleteNote = useMutation(api.academicScribe.deleteStudyNote);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Please Sign In</CardTitle>
            <CardDescription>
              You need to be logged in to access study notes.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (appUser === undefined) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Loading Study Notes</CardTitle>
            <CardDescription>
              Resolving your staff profile...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!userEmail || appUser === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>User Profile Not Ready</CardTitle>
            <CardDescription>
              Your staff profile was not found. Please complete staff setup before using Study Notes.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const resolvedUserId = appUser._id;

  const handleDeleteNote = async (noteId: string) => {
    if (confirm("Are you sure you want to delete this note?")) {
      try {
        await deleteNote({ noteId: noteId as Id<"studyNotes"> });
        setSelectedNoteId(null);
        toast.success("Note deleted");
      } catch {
        toast.error("Failed to delete note");
      }
    }
  };

  const handleAddTopic = () => {
    const trimmed = normalizeTopicName(newTopicName);
    if (!trimmed) {
      toast.error("Please enter a topic name.");
      return;
    }

    const topicKey = getTopicKey(trimmed);
    const exists = allSubjects.some((subject) => getTopicKey(subject) === topicKey);
    if (exists) {
      toast.message("That topic already exists.");
      setSelectedSubject(allSubjects.find((subject) => getTopicKey(subject) === topicKey) || trimmed);
      setNewTopicName("");
      setIsAddingTopic(false);
      return;
    }

    setCustomSubjects((prev) => dedupeTopics([...prev, trimmed]));
    setSelectedSubject(trimmed);
    setNewTopicName("");
    setIsAddingTopic(false);
    toast.success(`Added topic: ${trimmed}`);
  };

  const handleCreateFromSearch = () => {
    const trimmed = normalizeTopicName(searchQuery);
    if (!trimmed) return;
    setNewTopicName(trimmed);
    setIsAddingTopic(false);
    const topicKey = getTopicKey(trimmed);
    const exists = allSubjects.some((subject) => getTopicKey(subject) === topicKey);
    if (exists) {
      setSelectedSubject(allSubjects.find((subject) => getTopicKey(subject) === topicKey) || trimmed);
      toast.message("That topic already exists.");
      return;
    }
    setCustomSubjects((prev) => dedupeTopics([...prev, trimmed]));
    setSelectedSubject(trimmed);
    setTopicSearchTerm("");
    toast.success(`Added topic: ${trimmed}`);
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <BookOpen className="w-8 h-8 text-blue-600" />
            <h1 className="text-4xl font-bold text-slate-900 dark:text-white">Study Notes</h1>
          </div>
          <p className="text-slate-600 dark:text-slate-400">
            Record, organize, and revisit your class notes with AI-powered topic extraction
          </p>
        </div>

        {/* Subject Selector */}
        <div className="mb-6 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              value={topicSearchTerm}
              onChange={(event) => setTopicSearchTerm(event.target.value)}
              placeholder="Search topics (e.g., Medicine, Engineering, OB/GYN)"
              className="max-w-xl"
              onKeyDown={(event) => {
                if (event.key === "Enter" && searchQuery && !exactMatchSubject) {
                  event.preventDefault();
                  handleCreateFromSearch();
                }
              }}
            />
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 whitespace-nowrap">
                {searchQuery ? `${filteredSubjects.length} match${filteredSubjects.length === 1 ? "" : "es"}` : "Search to browse topics"}
              </span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="gap-1"
                onClick={() => setIsAddingTopic((current) => !current)}
              >
                <Plus className="h-4 w-4" />
                New Topic
              </Button>
            </div>
          </div>

          <div className="rounded-md border border-slate-200 bg-white/80 p-3 dark:border-slate-700 dark:bg-slate-900/40">
            {searchQuery ? (
              <div className="space-y-3">
                {!exactMatchSubject && (
                  <button
                    type="button"
                    className="w-full rounded-md border border-dashed border-blue-300 bg-blue-50 px-3 py-2 text-left text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-950/30 dark:text-blue-300 dark:hover:bg-blue-900/40"
                    onClick={handleCreateFromSearch}
                  >
                    Create &quot;{searchQuery}&quot;
                  </button>
                )}

                {filteredSubjects.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {filteredSubjects.map((subject) => (
                      <Button
                        key={subject}
                        onClick={() => setSelectedSubject(subject)}
                        variant={selectedSubject === subject ? "default" : "outline"}
                        size="sm"
                      >
                        {subject}
                      </Button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    No matching topics found.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Start typing in the search box to find a topic, or use New Topic to create one.
              </p>
            )}
          </div>

          {isAddingTopic && (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={newTopicName}
                onChange={(event) => setNewTopicName(event.target.value)}
                placeholder="Type custom topic (e.g., OB/GYN, Internal Medicine, Engineering)"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleAddTopic();
                  }
                }}
              />
              <div className="flex gap-2">
                <Button type="button" onClick={handleAddTopic}>Add</Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setNewTopicName("");
                    setIsAddingTopic(false);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Main Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as "record" | "timeline" | "topics" | "notebook" | "tools")}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-5 mb-6">
            <TabsTrigger value="record" className="gap-2">
              <Mic className="w-4 h-4" />
              <span className="hidden sm:inline">Record</span>
            </TabsTrigger>
            <TabsTrigger value="timeline" className="gap-2">
              <Clock className="w-4 h-4" />
              <span className="hidden sm:inline">Timeline</span>
            </TabsTrigger>
            <TabsTrigger value="topics" className="gap-2">
              <MessageCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Topics</span>
            </TabsTrigger>
            <TabsTrigger value="notebook" className="gap-2">
              <BookOpen className="w-4 h-4" />
              <span className="hidden sm:inline">Detail</span>
            </TabsTrigger>
            <TabsTrigger value="tools" className="gap-2">
              <Sparkles className="w-4 h-4" />
              <span className="hidden sm:inline">Tools</span>
            </TabsTrigger>
          </TabsList>

          {/* Record Tab */}
          <TabsContent value="record">
            <Card>
              <CardHeader>
                <CardTitle>Record Class Notes</CardTitle>
                <CardDescription>
                  Start recording your class. Your speech will be transcribed in real-time.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RecordingInterface
                  subject={selectedSubject}
                  userId={resolvedUserId}
                  isRecording={isRecording}
                  setIsRecording={setIsRecording}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Timeline Tab */}
          <TabsContent value="timeline">
            <Card>
              <CardHeader>
                <CardTitle>Class Notes Timeline</CardTitle>
                <CardDescription>
                  Chronological view of all recorded classes in {selectedSubject}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SessionTimeline
                  notes={notesBySubject || []}
                  selectedNoteId={selectedNoteId}
                  onSelectNote={setSelectedNoteId}
                  onDelete={handleDeleteNote}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Topics Tab */}
          <TabsContent value="topics">
            <Card>
              <CardHeader>
                <CardTitle>Topics & Concepts</CardTitle>
                <CardDescription>
                  Browse topics extracted from your {selectedSubject} notes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <TopicBrowser
                  topics={(topicIndex || []) as Array<{
                    topic: string;
                    frequency: number;
                    noteCount: number;
                    noteIds: Id<"studyNotes">[];
                  }>}
                  notes={notesBySubject || []}
                  onSelectNote={setSelectedNoteId}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notebook/Detail Tab */}
          <TabsContent value="notebook">
            {selectedNote ? (
              <NoteDetailView
                note={selectedNote}
                onClose={() => setSelectedNoteId(null)}
                onDelete={() => selectedNoteId && handleDeleteNote(selectedNoteId)}
              />
            ) : (
              <Card>
                <CardContent className="pt-8">
                  <div className="text-center text-slate-500">
                    <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Select a note from the timeline to view details</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Study Tools Tab */}
          <TabsContent value="tools">
            <StudyToolsPanel
              key={selectedSubject}
              subject={selectedSubject}
              notes={notesBySubject || []}
              userId={convexUserId}
              onSelectNote={(noteId) => {
                setSelectedNoteId(noteId);
                setActiveTab("notebook");
              }}
            />
          </TabsContent>
        </Tabs>

        {/* Quick Stats */}
        {notesBySubject && notesBySubject.length > 0 && (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">Total Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{notesBySubject.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">Topics Covered</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {topicIndex?.length || 0}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">Avg Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">-</div>
                <p className="text-xs text-slate-500 mt-1">Coming soon</p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
