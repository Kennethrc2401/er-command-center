"use client";

import { MessageCircle, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Doc, Id } from "@/convex/_generated/dataModel";

type EnrichedStudyNote = Omit<Doc<"studyNotes">, "topics"> & {
  topics: Array<{ topic: string; frequency: number; context?: string }>;
};

interface TopicBrowserProps {
  topics: Array<{
    topic: string;
    frequency: number;
    noteCount: number;
    noteIds: Id<"studyNotes">[];
  }>;
  notes: EnrichedStudyNote[];
  onSelectNote: (noteId: string) => void;
}

export default function TopicBrowser({
  topics,
  notes,
  onSelectNote,
}: TopicBrowserProps) {
  if (topics.length === 0) {
    return (
      <div className="text-center py-12">
        <MessageCircle className="w-12 h-12 mx-auto mb-4 text-slate-300" />
        <p className="text-slate-500">No topics found yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {topics.map((topicData) => {
          const relatedNotes = notes.filter((note) =>
            topicData.noteIds.includes(note._id)
          );

          return (
            <Card key={topicData.topic} className="hover:shadow-md transition-all">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">{topicData.topic}</CardTitle>
                  <Badge>{topicData.frequency}x</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Mentioned in {topicData.noteCount} note
                  {topicData.noteCount !== 1 ? "s" : ""}
                </p>

                {relatedNotes.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-slate-500 uppercase">
                      Related Notes
                    </p>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {relatedNotes.slice(0, 5).map((note) => (
                        <Button
                          key={note._id}
                          variant="outline"
                          size="sm"
                          className="w-full justify-start text-left h-auto py-2 px-2"
                          onClick={() => onSelectNote(note._id)}
                        >
                          <BookOpen className="w-3 h-3 mr-2 shrink-0" />
                          <span className="truncate text-xs">
                            {new Date(note.createdAt).toLocaleDateString()}
                          </span>
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Topic Cloud View */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Topic Cloud</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {topics.map((topicData) => {
              const maxFreq = Math.max(...topics.map((t) => t.frequency));
              const sizeMultiplier = topicData.frequency / maxFreq;
              const baseSizeClass =
                sizeMultiplier > 0.7
                  ? "text-lg font-semibold"
                  : sizeMultiplier > 0.4
                    ? "text-base font-medium"
                    : "text-sm";

              return (
                <Button
                  key={topicData.topic}
                  variant="outline"
                  onClick={() => {
                    // Scroll to the topic card
                    const element = document.getElementById(
                      `topic-${topicData.topic}`
                    );
                    element?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className={`${baseSizeClass} opacity-70 hover:opacity-100 transition-opacity`}
                >
                  {topicData.topic}
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
