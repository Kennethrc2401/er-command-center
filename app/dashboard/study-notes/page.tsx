"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useUser } from "@clerk/nextjs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, BookOpen, Mic, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import RecordingInterface from "../../../components/study-notes/RecordingInterface";
import SessionTimeline from "../../../components/study-notes/SessionTimeline";
import TopicBrowser from "../../../components/study-notes/TopicBrowser";
import NoteDetailView from "../../../components/study-notes/NoteDetailView";

const SUBJECTS = ["Calculus", "Quantum Mechanics", "Data Structures", "Biology", "Chemistry"];

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
  const [activeTab, setActiveTab] = useState<"record" | "timeline" | "topics" | "notebook">("record");
  const [selectedSubject, setSelectedSubject] = useState("Calculus");
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);

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
        <div className="mb-6 flex flex-wrap gap-2">
          {SUBJECTS.map((subject) => (
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

        {/* Main Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as "record" | "timeline" | "topics" | "notebook")}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-4 mb-6">
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
