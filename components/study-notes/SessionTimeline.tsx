"use client";

import { Clock, Trash2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Doc } from "@/convex/_generated/dataModel";

type EnrichedStudyNote = Omit<Doc<"studyNotes">, "topics"> & {
  topics: Array<{ topic: string; frequency: number; context?: string }>;
};

interface SessionTimelineProps {
  notes: EnrichedStudyNote[];
  selectedNoteId: string | null;
  onSelectNote: (noteId: string) => void;
  onDelete: (noteId: string) => void;
}

export default function SessionTimeline({
  notes,
  selectedNoteId,
  onSelectNote,
  onDelete,
}: SessionTimelineProps) {
  if (notes.length === 0) {
    return (
      <div className="text-center py-12">
        <Clock className="w-12 h-12 mx-auto mb-4 text-slate-300" />
        <p className="text-slate-500">No notes recorded yet</p>
      </div>
    );
  }

  const sortedNotes = [...notes].sort(
    (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
  );

  return (
    <div className="space-y-3">
      {sortedNotes.map((note) => (
        <Card
          key={note._id}
          className={`cursor-pointer transition-all ${
            selectedNoteId === note._id
              ? "ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900"
              : "hover:shadow-md"
          }`}
          onClick={() => onSelectNote(note._id)}
        >
          <CardContent className="pt-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-semibold">{note.subject}</h3>
                  <Badge variant="outline" className="text-xs">
                    {new Date(note.createdAt).toLocaleDateString()}
                  </Badge>
                  <Badge
                    variant={
                      note.organizationStatus === "summarized"
                        ? "default"
                        : "secondary"
                    }
                    className="text-xs"
                  >
                    {note.organizationStatus}
                  </Badge>
                </div>

                <p className="text-sm text-slate-600 dark:text-slate-400 mb-3 line-clamp-2">
                  {note.content}
                </p>

                {note.topics && note.topics.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {note.topics.slice(0, 5).map((topic, idx: number) => {
                      return (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {topic.topic}
                        </Badge>
                      );
                    })}
                    {note.topics.length > 5 && (
                      <Badge variant="outline" className="text-xs">
                        +{note.topics.length - 5}
                      </Badge>
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectNote(note._id);
                  }}
                >
                  <Eye className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-500 hover:text-red-700"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(note._id);
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
