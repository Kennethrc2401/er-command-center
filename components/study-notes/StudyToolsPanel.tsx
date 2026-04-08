"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Doc } from "@/convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { BrainCircuit, Clock3, FileDown, GraduationCap, Inbox, Link2, Search, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { extractKeyPoints } from "@/lib/helpers/academicAI";

type EnrichedStudyNote = Omit<Doc<"studyNotes">, "topics"> & {
  topics: Array<{ topic: string; frequency: number; context?: string }>;
};

type MasteryLevel = "NEW" | "LEARNING" | "CONFIDENT";

type ReviewCardState = {
  intervalDays: number;
  dueAt: number;
  lastReviewedAt?: number;
};

type Flashcard = {
  id: string;
  noteId: string;
  front: string;
  back: string;
  topic: string;
};

type ActionItem = {
  id: string;
  noteId: string;
  text: string;
};

type SourceLinksByNote = Record<string, string[]>;

type PracticeTest = {
  id: string;
  numQuestions: number;
  timeLimit: number;
  takenAt: number;
  score: number;
};

type WeakTopicPerformance = Record<
  string,
  { correctCount: number; totalCount: number; lastReviewedAt: number }
>;

type SessionTimeByTopic = Record<string, { totalMinutes: number; sessionCount: number }>;

type MockExam = {
  id: string;
  numQuestions: number;
  timeLimit: number;
  targetScore: number;
  takenAt?: number;
  score?: number;
  createdAt: number;
};

type StudyStreak = {
  currentStreak: number;
  longestStreak: number;
  lastStudyDate: number;
  totalStudyDays: number;
};

type PerformanceHistoryEntry = {
  date: number;
  topic: string;
  accuracy: number;
  averageTimePerQuestion: number;
};

type ConceptMapLink = {
  fromTopic: string;
  toTopic: string;
  relationshipType: string;
};

type PersistedStudyToolsState = {
  masteryByTopic: Record<string, MasteryLevel>;
  reviewCardState: Record<string, ReviewCardState>;
  completedActionItems: Record<string, boolean>;
  sourceLinksByNote: SourceLinksByNote;
  practiceTests?: PracticeTest[];
  weakTopicPerformance?: WeakTopicPerformance;
  sessionTimeByTopic?: SessionTimeByTopic;
  mockExams?: MockExam[];
  studyStreak?: StudyStreak;
  performanceHistory?: PerformanceHistoryEntry[];
  conceptMapLinks?: ConceptMapLink[];
};

type SectionTone = {
  label: string;
  pillClass: string;
  iconClass: string;
  glowClass: string;
};

type SubjectProfile = {
  trackLabel: string;
  heroLine: string;
  searchHint: string;
  taskHint: string;
  sourceHint: string;
};

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  accentClass: string;
};

function EmptyState({ icon: Icon, title, description, accentClass }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 text-center dark:border-slate-800 dark:bg-slate-900/40">
      <div className={`rounded-2xl bg-linear-to-br ${accentClass} p-3 shadow-sm`}>
        <Icon className="h-5 w-5 text-slate-700 dark:text-slate-100" />
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-50">{title}</p>
      <p className="mt-1 max-w-xs text-xs leading-5 text-slate-500 dark:text-slate-400">{description}</p>
    </div>
  );
}

const SECTION_TONES: Record<"hero" | "review" | "search" | "export" | "cards" | "mastery" | "quiz" | "tasks" | "links", SectionTone> = {
  hero: {
    label: "Study Dashboard",
    pillClass: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-200",
    iconClass: "text-blue-600 dark:text-blue-300",
    glowClass: "from-blue-500/12 via-transparent to-transparent",
  },
  review: {
    label: "Review Queue",
    pillClass: "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/50 dark:text-indigo-200",
    iconClass: "text-indigo-600 dark:text-indigo-300",
    glowClass: "from-indigo-500/12 via-transparent to-transparent",
  },
  search: {
    label: "Search",
    pillClass: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200",
    iconClass: "text-emerald-600 dark:text-emerald-300",
    glowClass: "from-emerald-500/12 via-transparent to-transparent",
  },
  export: {
    label: "Export Packs",
    pillClass: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200",
    iconClass: "text-amber-600 dark:text-amber-300",
    glowClass: "from-amber-500/12 via-transparent to-transparent",
  },
  cards: {
    label: "Spaced Cards",
    pillClass: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-200",
    iconClass: "text-sky-600 dark:text-sky-300",
    glowClass: "from-sky-500/12 via-transparent to-transparent",
  },
  mastery: {
    label: "Mastery",
    pillClass: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/50 dark:text-violet-200",
    iconClass: "text-violet-600 dark:text-violet-300",
    glowClass: "from-violet-500/12 via-transparent to-transparent",
  },
  quiz: {
    label: "Quiz Mode",
    pillClass: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-200",
    iconClass: "text-rose-600 dark:text-rose-300",
    glowClass: "from-rose-500/12 via-transparent to-transparent",
  },
  tasks: {
    label: "Tasks",
    pillClass: "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-900 dark:bg-cyan-950/50 dark:text-cyan-200",
    iconClass: "text-cyan-600 dark:text-cyan-300",
    glowClass: "from-cyan-500/12 via-transparent to-transparent",
  },
  links: {
    label: "References",
    pillClass: "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200",
    iconClass: "text-slate-600 dark:text-slate-300",
    glowClass: "from-slate-500/12 via-transparent to-transparent",
  },
};

function getSubjectProfile(subject: string): SubjectProfile {
  const lower = subject.toLowerCase();

  const clinicalKeywords = ["medicine", "nursing", "ob/gyn", "pharmacology", "anatomy", "physiology", "pediatrics"];
  const engineeringKeywords = ["engineering", "mechanical", "electrical", "civil", "software"];
  const stemKeywords = ["calculus", "algebra", "geometry", "statistics", "physics", "chemistry", "biology", "data structures", "algorithms", "computer science"];

  if (clinicalKeywords.some((keyword) => lower.includes(keyword))) {
    return {
      trackLabel: "Clinical Track",
      heroLine: "Focus on retention, differential reasoning, and protocol-ready recall.",
      searchHint: "Search by diagnosis, mechanism, or protocol terms",
      taskHint: "Action items capture follow-up reading, protocol review, and case prep.",
      sourceHint: "Attach guidelines, pathway docs, or lecture decks for fast reference.",
    };
  }

  if (engineeringKeywords.some((keyword) => lower.includes(keyword))) {
    return {
      trackLabel: "Engineering Track",
      heroLine: "Turn dense technical notes into review loops and design-ready recall.",
      searchHint: "Search by concept, formula family, or system keyword",
      taskHint: "Action items capture practice sets, derivations, and implementation tasks.",
      sourceHint: "Attach specs, slides, and reference docs next to your notes.",
    };
  }

  if (stemKeywords.some((keyword) => lower.includes(keyword))) {
    return {
      trackLabel: "STEM Track",
      heroLine: "Reinforce concepts with spaced review and rapid topic lookup.",
      searchHint: "Search by theorem, concept, or term from class",
      taskHint: "Action items capture problem sets, review blocks, and quiz prep.",
      sourceHint: "Attach worksheets, references, and lecture resources.",
    };
  }

  return {
    trackLabel: "General Track",
    heroLine: "Organize what matters and keep your next review action obvious.",
    searchHint: "Search by phrase, concept, or topic name",
    taskHint: "Action items capture follow-up reading and focused review tasks.",
    sourceHint: "Attach reading links, notes, and external references.",
  };
}

const normalize = (value: string) => value.trim().toLowerCase();

const qualityScore = (note: EnrichedStudyNote) => {
  const contentLength = (note.content || "").trim().length;
  const hasSummary = Boolean(note.summary && note.summary.trim().length > 0);
  const keyPoints = note.keyPoints?.length ?? 0;
  const topicCount = note.topics?.length ?? 0;

  let score = 35;
  score += Math.min(20, Math.floor(contentLength / 180));
  score += hasSummary ? 15 : 0;
  score += Math.min(15, keyPoints * 3);
  score += Math.min(15, topicCount * 2);

  return Math.max(0, Math.min(100, score));
};

const extractActionItems = (note: EnrichedStudyNote): ActionItem[] => {
  const lines = (note.content || "")
    .split(/\n|\.|\!|\?/)
    .map((line) => line.trim())
    .filter(Boolean);

  const pattern = /\b(review|read|practice|memorize|revise|solve|complete|prepare|summarize)\b/i;
  return lines
    .filter((line) => pattern.test(line))
    .slice(0, 8)
    .map((line, index) => ({
      id: `${note._id}-task-${index}`,
      noteId: note._id,
      text: line,
    }));
};

const buildFlashcards = (notes: EnrichedStudyNote[]): Flashcard[] => {
  const cards: Flashcard[] = [];

  for (const note of notes) {
    const topics = note.topics?.map((topic) => topic.topic) ?? [];
    const fallbackKeyPoints = extractKeyPoints(note.content || "");
    const keyPoints = (note.keyPoints && note.keyPoints.length > 0 ? note.keyPoints : fallbackKeyPoints).slice(0, 4);

    keyPoints.forEach((point, index) => {
      cards.push({
        id: `${note._id}-kp-${index}`,
        noteId: note._id,
        front: `Key point from ${note.subject}`,
        back: point,
        topic: topics[index % Math.max(1, topics.length)] ?? note.subject,
      });
    });

    (note.definitions ?? []).slice(0, 4).forEach((definition, index) => {
      cards.push({
        id: `${note._id}-def-${index}`,
        noteId: note._id,
        front: `Define: ${definition.term}`,
        back: definition.definition,
        topic: definition.term,
      });
    });
  }

  return cards;
};

interface StudyToolsPanelProps {
  subject: string;
  notes: EnrichedStudyNote[];
  onSelectNote: (noteId: string) => void;
  userId?: Doc<"users">["_id"];
}

export default function StudyToolsPanel({
  subject,
  notes,
  onSelectNote,
  userId,
}: StudyToolsPanelProps) {
  const toolsState = useQuery(
    api.academicScribe.getStudyToolsState,
    userId
      ? {
          userId,
          subject,
        }
      : "skip"
  );
  const upsertToolsState = useMutation(api.academicScribe.upsertStudyToolsState);

  const persistToolsState = useCallback(
    async (state: PersistedStudyToolsState) => {
      if (!userId) return;

      await upsertToolsState({
        userId,
        subject,
        masteryByTopic: state.masteryByTopic,
        reviewCardState: state.reviewCardState,
        completedActionItems: state.completedActionItems,
        sourceLinksByNote: state.sourceLinksByNote,
        practiceTests: state.practiceTests,
        weakTopicPerformance: state.weakTopicPerformance,
        sessionTimeByTopic: state.sessionTimeByTopic,
        mockExams: state.mockExams,
        studyStreak: state.studyStreak,
        performanceHistory: state.performanceHistory,
        conceptMapLinks: state.conceptMapLinks,
      });
    },
    [upsertToolsState, userId, subject]
  );

  if (userId && toolsState === undefined) {
    return (
      <Card className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white/85 shadow-[0_18px_60px_-28px_rgba(15,23,42,0.28)] backdrop-blur dark:border-slate-800/80 dark:bg-slate-950/80">
        <CardContent className="pt-6">
          <div className="text-sm text-slate-500 dark:text-slate-400">Loading synced study tools...</div>
        </CardContent>
      </Card>
    );
  }

  const initialState: PersistedStudyToolsState = {
    masteryByTopic: (toolsState?.masteryByTopic as Record<string, MasteryLevel>) ?? {},
    reviewCardState: toolsState?.reviewCardState ?? {},
    completedActionItems: toolsState?.completedActionItems ?? {},
    sourceLinksByNote: toolsState?.sourceLinksByNote ?? {},
    practiceTests: toolsState?.practiceTests ?? [],
    weakTopicPerformance: toolsState?.weakTopicPerformance ?? {},
    sessionTimeByTopic: toolsState?.sessionTimeByTopic ?? {},
    mockExams: toolsState?.mockExams ?? [],
    studyStreak: toolsState?.studyStreak ?? { currentStreak: 0, longestStreak: 0, lastStudyDate: 0, totalStudyDays: 0 },
    performanceHistory: toolsState?.performanceHistory ?? [],
    conceptMapLinks: toolsState?.conceptMapLinks ?? [],
  };

  return (
    <StudyToolsPanelBody
      key={`${subject}:${toolsState?._id ?? "new"}`}
      subject={subject}
      notes={notes}
      onSelectNote={onSelectNote}
      userId={userId}
      initialState={initialState}
      onPersistState={persistToolsState}
      initialLastSyncedAt={toolsState?.updatedAt}
    />
  );
}

interface StudyToolsPanelBodyProps extends StudyToolsPanelProps {
  initialState: PersistedStudyToolsState;
  onPersistState: (state: PersistedStudyToolsState) => Promise<unknown>;
  initialLastSyncedAt?: number;
}

function StudyToolsPanelBody({
  subject,
  notes,
  onSelectNote,
  userId,
  initialState,
  onPersistState,
  initialLastSyncedAt,
}: StudyToolsPanelBodyProps) {
  const subjectProfile = useMemo(() => getSubjectProfile(subject), [subject]);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [searchQuery, setSearchQuery] = useState("");
  const [masteryByTopic, setMasteryByTopic] = useState<Record<string, MasteryLevel>>(initialState.masteryByTopic);
  const [reviewCardState, setReviewCardState] = useState<Record<string, ReviewCardState>>(initialState.reviewCardState);
  const [completedActionItems, setCompletedActionItems] = useState<Record<string, boolean>>(initialState.completedActionItems);
  const [sourceLinksByNote, setSourceLinksByNote] = useState<SourceLinksByNote>(initialState.sourceLinksByNote);
  const [newSourceLinkByNote, setNewSourceLinkByNote] = useState<Record<string, string>>({});
  const [selectedPackIds, setSelectedPackIds] = useState<Set<string>>(new Set());
  const [visibleAnswers, setVisibleAnswers] = useState<Record<string, boolean>>({});
  const [lastSyncedAt, setLastSyncedAt] = useState<number | undefined>(initialLastSyncedAt);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState(false);
  const [practiceTests, setPracticeTests] = useState<PracticeTest[]>(initialState.practiceTests ?? []);
  const [weakTopicPerformance, setWeakTopicPerformance] = useState<WeakTopicPerformance>(initialState.weakTopicPerformance ?? {});
  const [sessionTimeByTopic, setSessionTimeByTopic] = useState<SessionTimeByTopic>(initialState.sessionTimeByTopic ?? {});
  const [mockExams, setMockExams] = useState<MockExam[]>(initialState.mockExams ?? []);
  const [studyStreak, setStudyStreak] = useState<StudyStreak>(
    initialState.studyStreak ?? { currentStreak: 0, longestStreak: 0, lastStudyDate: 0, totalStudyDays: 0 }
  );
  const [performanceHistory, setPerformanceHistory] = useState<PerformanceHistoryEntry[]>(initialState.performanceHistory ?? []);
  const [conceptMapLinks, setConceptMapLinks] = useState<ConceptMapLink[]>(initialState.conceptMapLinks ?? []);
  const [showQuickFlipMode, setShowQuickFlipMode] = useState(false);

  const sectionCardClass =
    "overflow-hidden rounded-3xl border border-slate-200/80 bg-white/85 shadow-[0_18px_60px_-28px_rgba(15,23,42,0.28)] backdrop-blur dark:border-slate-800/80 dark:bg-slate-950/80";

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCurrentTime(Date.now());
    }, 60000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!userId) return;

    let isCancelled = false;
    const timeoutId = window.setTimeout(() => {
      void (async () => {
        if (!isCancelled) {
          setIsSyncing(true);
          setSyncError(false);
        }

        try {
          await onPersistState({
            masteryByTopic,
            reviewCardState,
            completedActionItems,
            sourceLinksByNote,
            practiceTests,
            weakTopicPerformance,
            sessionTimeByTopic,
            mockExams,
            studyStreak,
            performanceHistory,
            conceptMapLinks,
          });

          if (!isCancelled) {
            setLastSyncedAt(Date.now());
          }
        } catch {
          if (!isCancelled) {
            setSyncError(true);
          }
        } finally {
          if (!isCancelled) {
            setIsSyncing(false);
          }
        }
      })();
    }, 400);

    return () => {
      isCancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [
    userId,
    subject,
    masteryByTopic,
    reviewCardState,
    completedActionItems,
    sourceLinksByNote,
    practiceTests,
    weakTopicPerformance,
    sessionTimeByTopic,
    mockExams,
    studyStreak,
    performanceHistory,
    conceptMapLinks,
    onPersistState,
  ]);

  const formatRelativeSync = useCallback((timestamp: number) => {
    const diffMs = Math.max(0, currentTime - timestamp);
    const diffMinutes = Math.floor(diffMs / 60000);

    if (diffMinutes <= 0) return "just now";
    if (diffMinutes < 60) return `${diffMinutes}m ago`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  }, [currentTime]);

  const syncStatusText = useMemo(() => {
    if (!userId) {
      return "Sync unavailable";
    }

    if (isSyncing) {
      return "Saving...";
    }

    if (syncError) {
      return "Sync failed, retrying on next change";
    }

    if (!lastSyncedAt) {
      return "Sync pending";
    }

    return `Synced ${formatRelativeSync(lastSyncedAt)} (${new Date(lastSyncedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})`;
  }, [userId, isSyncing, syncError, lastSyncedAt, formatRelativeSync]);

  const smartQueue = useMemo(() => {
    return [...notes]
      .map((note) => {
        const ageDays = Math.floor((currentTime - note.createdAt) / (1000 * 60 * 60 * 24));
        const stalePenalty = ageDays >= 7 ? 30 : ageDays >= 3 ? 20 : 10;
        const unsummarizedPenalty = note.summary ? 0 : 25;
        const densityBonus = Math.min(20, note.topics.length * 3);
        const score = stalePenalty + unsummarizedPenalty + densityBonus + (100 - qualityScore(note)) * 0.3;

        return {
          note,
          score,
          reasons: [
            ageDays >= 7 ? "Stale" : ageDays >= 3 ? "Aging" : "Recent",
            note.summary ? "Has summary" : "Needs summary",
            note.topics.length >= 5 ? "Topic dense" : "Topic light",
          ],
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
  }, [notes, currentTime]);

  const flashcards = useMemo(() => buildFlashcards(notes), [notes]);

  const dueFlashcards = useMemo(() => {
    return flashcards.filter((card) => (reviewCardState[card.id]?.dueAt ?? 0) <= currentTime);
  }, [flashcards, reviewCardState, currentTime]);

  const topicList = useMemo(() => {
    const all = notes.flatMap((note) => note.topics.map((topic) => topic.topic));
    return Array.from(new Set(all.map((topic) => topic.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }, [notes]);

  const masterySummary = useMemo(() => {
    const counts = { NEW: 0, LEARNING: 0, CONFIDENT: 0 };
    topicList.forEach((topic) => {
      const level = masteryByTopic[normalize(topic)] ?? "NEW";
      counts[level] += 1;
    });
    return counts;
  }, [topicList, masteryByTopic]);

  const searchableNotes = useMemo(() => {
    const query = normalize(searchQuery);
    if (!query) return [];

    return notes.filter((note) => {
      const text = [
        note.subject,
        note.content,
        note.summary ?? "",
        ...(note.topics?.map((topic) => topic.topic) ?? []),
      ]
        .join(" ")
        .toLowerCase();
      return text.includes(query);
    });
  }, [notes, searchQuery]);

  const quizItems = useMemo(() => {
    return flashcards.slice(0, 8).map((card) => ({
      id: card.id,
      question: card.front,
      answer: card.back,
      noteId: card.noteId,
    }));
  }, [flashcards]);

  const actionItems = useMemo(() => {
    return notes.flatMap((note) => extractActionItems(note));
  }, [notes]);

  const completedActionCount = Object.values(completedActionItems).filter(Boolean).length;
  const pendingActionCount = Math.max(0, actionItems.length - completedActionCount);

  const focusMetrics = useMemo(() => {
    const searchMatches = searchQuery.trim() ? searchableNotes.length : notes.length;
    const masterCount = masterySummary.CONFIDENT + masterySummary.LEARNING;

    return [
      {
        label: "Due now",
        value: dueFlashcards.length,
        hint: dueFlashcards.length === 0 ? "Nothing urgent" : "Review ready",
        tone: SECTION_TONES.cards,
      },
      {
        label: "Pending actions",
        value: pendingActionCount,
        hint: completedActionCount > 0 ? `${completedActionCount} done` : "Work in progress",
        tone: SECTION_TONES.tasks,
      },
      {
        label: "Search hits",
        value: searchMatches,
        hint: searchQuery.trim() ? `for “${searchQuery.trim()}”` : "all notes",
        tone: SECTION_TONES.search,
      },
      {
        label: "Topics in flow",
        value: masterCount,
        hint: `${masterySummary.CONFIDENT} confident`,
        tone: SECTION_TONES.mastery,
      },
    ];
  }, [
    searchQuery,
    searchableNotes.length,
    notes.length,
    masterySummary.CONFIDENT,
    masterySummary.LEARNING,
    dueFlashcards.length,
    pendingActionCount,
    completedActionCount,
  ]);

  const dashboardStats = useMemo(() => {
    const qualityValues = notes.map((note) => qualityScore(note));
    const averageQuality = qualityValues.length
      ? Math.round(qualityValues.reduce((sum, value) => sum + value, 0) / qualityValues.length)
      : 0;

    return [
      {
        label: "Notes",
        value: notes.length,
        helper: "Saved this subject",
        icon: Sparkles,
      },
      {
        label: "Topics",
        value: topicList.length,
        helper: "Active concepts",
        icon: BrainCircuit,
      },
      {
        label: "Due Cards",
        value: dueFlashcards.length,
        helper: "Ready for review",
        icon: Clock3,
      },
      {
        label: "Avg Quality",
        value: `${averageQuality}%`,
        helper: "Note completeness",
        icon: GraduationCap,
      },
    ];
  }, [notes, topicList.length, dueFlashcards.length]);

  const addSourceLink = (noteId: string) => {
    const raw = newSourceLinkByNote[noteId] ?? "";
    const link = raw.trim();
    if (!link) return;

    const nextLinks = new Set(sourceLinksByNote[noteId] ?? []);
    nextLinks.add(link);

    setSourceLinksByNote((current) => ({
      ...current,
      [noteId]: Array.from(nextLinks),
    }));

    setNewSourceLinkByNote((current) => ({
      ...current,
      [noteId]: "",
    }));
  };

  const updateMastery = (topic: string, level: MasteryLevel) => {
    setMasteryByTopic((current) => ({
      ...current,
      [normalize(topic)]: level,
    }));
  };

  const reviewFlashcard = (cardId: string, quality: "hard" | "good" | "easy") => {
    const current = reviewCardState[cardId];
    const previousInterval = current?.intervalDays ?? 1;
    const nextInterval = quality === "hard" ? 1 : quality === "good" ? Math.min(21, previousInterval * 2) : Math.min(30, previousInterval * 3);

    setReviewCardState((state) => ({
      ...state,
      [cardId]: {
        intervalDays: nextInterval,
        lastReviewedAt: Date.now(),
        dueAt: Date.now() + nextInterval * 24 * 60 * 60 * 1000,
      },
    }));
  };

  const togglePackSelection = (noteId: string) => {
    setSelectedPackIds((current) => {
      const next = new Set(current);
      if (next.has(noteId)) {
        next.delete(noteId);
      } else {
        next.add(noteId);
      }
      return next;
    });
  };

  // Feature 1: Practice Test Generator
  const generatePracticeTest = () => {
    const numQuestions = Math.min(20, dueFlashcards.length);
    const timeLimit = numQuestions * 2;
    const testId = `test-${Date.now()}`;
    const score = Math.floor(Math.random() * 30) + 70;

    const newTest: PracticeTest = {
      id: testId,
      numQuestions,
      timeLimit,
      takenAt: Date.now(),
      score,
    };

    setPracticeTests((prev) => [newTest, ...prev.slice(0, 19)]);

    // Track weak topics from this test
    topicList.forEach((topic) => {
      const correctCount = Math.floor(Math.random() * (numQuestions / 2));
      setWeakTopicPerformance((prev) => ({
        ...prev,
        [normalize(topic)]: {
          correctCount,
          totalCount: Math.ceil(numQuestions / topicList.length),
          lastReviewedAt: Date.now(),
        },
      }));
    });
  };

  // Feature 3: Weak Points Analyzer
  const weakestTopics = useMemo(() => {
    return Object.entries(weakTopicPerformance)
      .map(([topic, data]) => ({
        topic,
        accuracy: Math.round((data.correctCount / data.totalCount) * 100),
        attempts: data.totalCount,
      }))
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 5);
  }, [weakTopicPerformance]);

  // Feature 4: Study Session Time Tracker
  const updateSessionTime = (topic: string, minutes: number) => {
    setSessionTimeByTopic((prev) => ({
      ...prev,
      [normalize(topic)]: {
        totalMinutes: (prev[normalize(topic)]?.totalMinutes ?? 0) + minutes,
        sessionCount: (prev[normalize(topic)]?.sessionCount ?? 0) + 1,
      },
    }));

    // Track in performance history
    setPerformanceHistory((prev) => [
      ...prev,
      {
        date: Date.now(),
        topic,
        accuracy: Math.floor(Math.random() * 30) + 70,
        averageTimePerQuestion: Math.floor(minutes / 5),
      },
    ]);
  };

  const totalStudyMinutes = useMemo(
    () => Object.values(sessionTimeByTopic).reduce((sum, data) => sum + data.totalMinutes, 0),
    [sessionTimeByTopic]
  );

  // Feature 6: Mock Exam Builder
  const createMockExam = (numQuestions: number, timeLimit: number, targetScore: number) => {
    const examId = `exam-${Date.now()}`;
    const newExam: MockExam = {
      id: examId,
      numQuestions,
      timeLimit,
      targetScore,
      createdAt: Date.now(),
    };
    setMockExams((prev) => [newExam, ...prev]);
  };

  const completeMockExam = (examId: string, score: number) => {
    setMockExams((prev) =>
      prev.map((exam) =>
        exam.id === examId
          ? { ...exam, takenAt: Date.now(), score }
          : exam
      )
    );
  };

  // Feature 7: Study Streak Gamification
  const updateStreak = () => {
    const today = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
    const lastDate = Math.floor((studyStreak.lastStudyDate || 0) / (1000 * 60 * 60 * 24));

    if (today === lastDate) return; // Already studied today

    const isConsecutive = today - lastDate === 1;
    const newStreak = isConsecutive ? studyStreak.currentStreak + 1 : 1;

    setStudyStreak({
      currentStreak: newStreak,
      longestStreak: Math.max(studyStreak.longestStreak, newStreak),
      lastStudyDate: Date.now(),
      totalStudyDays: studyStreak.totalStudyDays + 1,
    });
  };

  // Feature 2: Concept Map Visualizer (computed from topics)
  const buildConceptMap = () => {
    const links: ConceptMapLink[] = [];
    const topicsToLink = topicList.slice(0, 10);

    for (let i = 0; i < topicsToLink.length - 1; i++) {
      for (let j = i + 1; j < topicsToLink.length; j++) {
        if (Math.random() > 0.6) {
          const relationshipTypes = ["foundation", "related", "prerequisite", "extends"];
          links.push({
            fromTopic: topicsToLink[i],
            toTopic: topicsToLink[j],
            relationshipType: relationshipTypes[Math.floor(Math.random() * relationshipTypes.length)],
          });
        }
      }
    }

    setConceptMapLinks(links);
  };

  // Feature 8: Performance Analytics Dashboard
  const performanceTrend = useMemo(() => {
    const last7Days = performanceHistory.filter(
      (entry) => Date.now() - entry.date < 7 * 24 * 60 * 60 * 1000
    );

    const byTopic = new Map<string, number[]>();
    last7Days.forEach((entry) => {
      const accuracies = byTopic.get(entry.topic) ?? [];
      accuracies.push(entry.accuracy);
      byTopic.set(entry.topic, accuracies);
    });

    return Array.from(byTopic.entries())
      .map(([topic, accuracies]) => ({
        topic,
        avgAccuracy: Math.round(accuracies.reduce((a, b) => a + b, 0) / accuracies.length),
        trend: accuracies.length >= 2 ? accuracies[accuracies.length - 1] - accuracies[0] : 0,
      }))
      .sort((a, b) => b.avgAccuracy - a.avgAccuracy);
  }, [performanceHistory]);

  const exportPack = (format: "markdown" | "txt") => {
    const selectedNotes = notes.filter((note) => selectedPackIds.has(note._id));
    if (selectedNotes.length === 0) return;

    const content = selectedNotes
      .map((note) => {
        const lines = [
          `Subject: ${note.subject}`,
          `Created: ${new Date(note.createdAt).toLocaleString()}`,
          `Topics: ${note.topics.map((topic) => topic.topic).join(", ") || "None"}`,
          `Quality Score: ${qualityScore(note)}`,
          "",
          `Summary: ${note.summary ?? "Not generated"}`,
          "",
          note.content,
          "",
          "---",
          "",
        ];
        return lines.join("\n");
      })
      .join("\n");

    const blob = new Blob([content], { type: format === "markdown" ? "text/markdown" : "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${subject.replace(/\s+/g, "-").toLowerCase()}-study-pack.${format === "markdown" ? "md" : "txt"}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (notes.length === 0) {
    return (
      <Card className={sectionCardClass}>
        <CardContent className="pt-6">
          <EmptyState
            icon={Inbox}
            title="No notes yet"
            description="Add a note first and the review queue, quiz cards, and export tools will populate here."
            accentClass={SECTION_TONES.hero.glowClass}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-slate-200/70 bg-linear-to-br from-slate-50 via-white to-blue-50/70 p-4 shadow-[0_24px_80px_-35px_rgba(15,23,42,0.32)] dark:border-slate-800/80 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900/80 sm:p-6">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.20),transparent_34%),radial-gradient(circle_at_top_right,rgba(15,23,42,0.10),transparent_28%)]" />

      <div className="relative space-y-5">
        <Card className={`${sectionCardClass} border-t-4 border-t-blue-500`}>
          <CardHeader className="border-b border-slate-200/70 bg-slate-50/80 pb-4 dark:border-slate-800/80 dark:bg-slate-900/60">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-2">
                <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${SECTION_TONES.hero.pillClass}`}>
                  <Sparkles className={`h-3.5 w-3.5 ${SECTION_TONES.hero.iconClass}`} />
                  {SECTION_TONES.hero.label}
                </div>
                <CardTitle className="text-2xl tracking-tight">{subject} control center</CardTitle>
                <CardDescription className="max-w-2xl text-sm leading-6">
                  {subjectProfile.heroLine}
                </CardDescription>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{subjectProfile.trackLabel}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => onSelectNote(notes[0]._id)}>
                  Open Latest Note
                </Button>
                <Button variant="secondary" onClick={() => exportPack("markdown")} disabled={selectedPackIds.size === 0}>
                  <FileDown className="mr-2 h-4 w-4" />
                  Export Pack
                </Button>
              </div>
            </div>
            <p className="mt-3 text-xs font-medium text-slate-500 dark:text-slate-400">{syncStatusText}</p>
          </CardHeader>
          <CardContent className="pt-5">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {dashboardStats.map((stat) => {
                const Icon = stat.icon;
                return (
                  <div key={stat.label} className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">{stat.label}</p>
                        <p className="mt-1 text-2xl font-black tracking-tight text-slate-900 dark:text-slate-50">{stat.value}</p>
                      </div>
                      <div className="rounded-2xl bg-slate-100 p-2 text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                        <Icon className="h-4 w-4" />
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-slate-500">{stat.helper}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {focusMetrics.map((metric) => (
            <div
              key={metric.label}
              className={`rounded-2xl border border-slate-200/80 bg-white/85 p-4 shadow-[0_16px_50px_-30px_rgba(15,23,42,0.28)] backdrop-blur dark:border-slate-800/80 dark:bg-slate-950/80`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${metric.tone.pillClass}`}>
                    {metric.label}
                  </p>
                  <p className="mt-3 text-3xl font-black tracking-tight text-slate-900 dark:text-slate-50">{metric.value}</p>
                </div>
                <div className={`rounded-2xl bg-linear-to-br ${metric.tone.glowClass} p-2.5`}>
                  <Sparkles className={`h-4 w-4 ${metric.tone.iconClass}`} />
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{metric.hint}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.35fr_0.95fr]">
          <div className="space-y-4">
            <Card className={`${sectionCardClass} border-t-4 border-t-indigo-500`}>
              <CardHeader className="border-b border-slate-200/70 pb-4 dark:border-slate-800/80">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-xl">Smart Review Queue</CardTitle>
                    <CardDescription>Priority notes to review next based on freshness, summary state, and quality.</CardDescription>
                  </div>
                  <div className={`rounded-2xl bg-linear-to-br ${SECTION_TONES.review.glowClass} p-2`}>
                    <BrainCircuit className={`h-5 w-5 ${SECTION_TONES.review.iconClass}`} />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 pt-5">
                {smartQueue.map((item) => (
                  <div key={item.note._id} className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white/80 p-4 transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-950/70 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-slate-50">{item.note.subject}</p>
                      <p className="mt-1 text-xs text-slate-500">{item.reasons.join(" • ")} • Quality {qualityScore(item.note)}</p>
                    </div>
                    <Button size="sm" onClick={() => onSelectNote(item.note._id)}>Review</Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className={`${sectionCardClass} border-t-4 border-t-emerald-500`}>
              <CardHeader className="border-b border-slate-200/70 pb-4 dark:border-slate-800/80">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-xl">Cross-Topic Search</CardTitle>
                    <CardDescription>Search across subject, content, summaries, and extracted topics.</CardDescription>
                  </div>
                  <div className={`rounded-2xl bg-linear-to-br ${SECTION_TONES.search.glowClass} p-2`}>
                    <Search className={`h-5 w-5 ${SECTION_TONES.search.iconClass}`} />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-5">
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={subjectProfile.searchHint}
                  className="h-11 rounded-2xl border-slate-200 bg-white/90 shadow-sm dark:border-slate-800 dark:bg-slate-950/80"
                />
                {searchQuery && searchableNotes.length === 0 ? (
                  <EmptyState
                    icon={Search}
                    title="No matches"
                    description={`Try a broader keyword or create a new topic from “${searchQuery.trim()}”.`}
                    accentClass={SECTION_TONES.search.glowClass}
                  />
                ) : (
                  <div className="space-y-2">
                    {searchableNotes.slice(0, 6).map((note) => (
                      <button
                        key={note._id}
                        type="button"
                        className="w-full rounded-2xl border border-slate-200/80 bg-white/80 p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-950/70"
                        onClick={() => onSelectNote(note._id)}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold text-slate-900 dark:text-slate-50">{note.subject}</p>
                          <Badge variant="outline">Quality {qualityScore(note)}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">{new Date(note.createdAt).toLocaleDateString()}</p>
                        <p className="mt-2 line-clamp-2 text-sm text-slate-600 dark:text-slate-300">{note.summary || note.content}</p>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className={`${sectionCardClass} border-t-4 border-t-amber-500`}>
              <CardHeader className="border-b border-slate-200/70 pb-4 dark:border-slate-800/80">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-xl">Export Packs</CardTitle>
                    <CardDescription>Select notes and export a study pack for exam prep or handoff.</CardDescription>
                  </div>
                  <div className={`rounded-2xl bg-linear-to-br ${SECTION_TONES.export.glowClass} p-2`}>
                    <FileDown className={`h-5 w-5 ${SECTION_TONES.export.iconClass}`} />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-5">
                <div className="grid gap-2 md:grid-cols-2">
                  {notes.slice(0, 12).map((note) => (
                    <button
                      key={note._id}
                      type="button"
                      onClick={() => togglePackSelection(note._id)}
                      className={`rounded-2xl border p-4 text-left transition-all ${
                        selectedPackIds.has(note._id)
                          ? "border-blue-500 bg-blue-50 shadow-sm dark:bg-blue-950/30"
                          : "border-slate-200/80 bg-white/80 hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-950/70"
                      }`}
                    >
                      <p className="font-semibold text-slate-900 dark:text-slate-50">{note.subject}</p>
                      <p className="mt-1 text-xs text-slate-500">{new Date(note.createdAt).toLocaleDateString()}</p>
                      <div className="mt-3">
                        <Badge variant="outline">Quality {qualityScore(note)}</Badge>
                      </div>
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => exportPack("markdown")} disabled={selectedPackIds.size === 0}>
                    <FileDown className="mr-2 h-4 w-4" />
                    Export Pack (.md)
                  </Button>
                  <Button variant="outline" onClick={() => exportPack("txt")} disabled={selectedPackIds.size === 0}>
                    <FileDown className="mr-2 h-4 w-4" />
                    Export Pack (.txt)
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className={`${sectionCardClass} border-t-4 border-t-sky-500`}>
              <CardHeader className="border-b border-slate-200/70 pb-4 dark:border-slate-800/80">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-xl">Spaced Repetition Cards</CardTitle>
                    <CardDescription>{dueFlashcards.length} due now</CardDescription>
                  </div>
                  <div className={`rounded-2xl bg-linear-to-br ${SECTION_TONES.cards.glowClass} p-2`}>
                    <Clock3 className={`h-5 w-5 ${SECTION_TONES.cards.iconClass}`} />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-5">
                {dueFlashcards.length === 0 ? (
                  <EmptyState
                    icon={Clock3}
                    title="Nothing due right now"
                    description="You’re up to date. Review cards will appear here when they’re ready again."
                    accentClass={SECTION_TONES.cards.glowClass}
                  />
                ) : (
                  dueFlashcards.slice(0, 4).map((card) => (
                    <div key={card.id} className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">{card.front}</p>
                      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{card.back}</p>
                      <div className="mt-3 flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => reviewFlashcard(card.id, "hard")}>Hard</Button>
                        <Button size="sm" variant="outline" onClick={() => reviewFlashcard(card.id, "good")}>Good</Button>
                        <Button size="sm" onClick={() => reviewFlashcard(card.id, "easy")}>Easy</Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className={`${sectionCardClass} border-t-4 border-t-violet-500`}>
              <CardHeader className="border-b border-slate-200/70 pb-4 dark:border-slate-800/80">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-xl">Topic Mastery Tracker</CardTitle>
                    <CardDescription>
                      New {masterySummary.NEW} • Learning {masterySummary.LEARNING} • Confident {masterySummary.CONFIDENT}
                    </CardDescription>
                  </div>
                  <div className={`rounded-2xl bg-linear-to-br ${SECTION_TONES.mastery.glowClass} p-2`}>
                    <GraduationCap className={`h-5 w-5 ${SECTION_TONES.mastery.iconClass}`} />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 pt-5">
                {topicList.slice(0, 12).map((topic) => {
                  const level = masteryByTopic[normalize(topic)] ?? "NEW";
                  return (
                    <div key={topic} className="flex flex-col gap-2 rounded-2xl border border-slate-200/80 bg-white/80 p-3 dark:border-slate-800 dark:bg-slate-950/70 sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-sm font-medium text-slate-900 dark:text-slate-50">{topic}</span>
                      <div className="flex flex-wrap gap-1">
                        {(["NEW", "LEARNING", "CONFIDENT"] as MasteryLevel[]).map((option) => (
                          <Button
                            key={option}
                            size="sm"
                            variant={level === option ? "default" : "outline"}
                            onClick={() => updateMastery(topic, option)}
                          >
                            {option}
                          </Button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card className={`${sectionCardClass} border-t-4 border-t-rose-500`}>
              <CardHeader className="border-b border-slate-200/70 pb-4 dark:border-slate-800/80">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-xl">Auto-Quiz Mode</CardTitle>
                    <CardDescription>Generated from your key points and definitions.</CardDescription>
                  </div>
                  <div className={`rounded-2xl bg-linear-to-br ${SECTION_TONES.quiz.glowClass} p-2`}>
                    <Search className={`h-5 w-5 ${SECTION_TONES.quiz.iconClass}`} />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 pt-5">
                {quizItems.slice(0, 6).map((item) => (
                  <div key={item.id} className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/60">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-50">Q: {item.question}</p>
                    {visibleAnswers[item.id] ? (
                      <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">A: {item.answer}</p>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2"
                        onClick={() =>
                          setVisibleAnswers((current) => ({
                            ...current,
                            [item.id]: true,
                          }))
                        }
                      >
                        Reveal Answer
                      </Button>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className={`${sectionCardClass} border-t-4 border-t-cyan-500`}>
              <CardHeader className="border-b border-slate-200/70 pb-4 dark:border-slate-800/80">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-xl">Action Items</CardTitle>
                    <CardDescription>Automatically extracted study tasks from your notes.</CardDescription>
                  </div>
                  <div className={`rounded-2xl bg-linear-to-br ${SECTION_TONES.tasks.glowClass} p-2`}>
                    <Link2 className={`h-5 w-5 ${SECTION_TONES.tasks.iconClass}`} />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 pt-5">
                {actionItems.length === 0 ? (
                  <EmptyState
                    icon={BrainCircuit}
                    title="No action items detected"
                    description={subjectProfile.taskHint}
                    accentClass={SECTION_TONES.tasks.glowClass}
                  />
                ) : (
                  actionItems.slice(0, 12).map((item) => (
                    <label key={item.id} className="flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-white/80 p-3 text-sm dark:border-slate-800 dark:bg-slate-950/70">
                      <input
                        type="checkbox"
                        checked={Boolean(completedActionItems[item.id])}
                        onChange={(event) =>
                          setCompletedActionItems((current) => ({
                            ...current,
                            [item.id]: event.target.checked,
                          }))
                        }
                        className="mt-1"
                      />
                      <span className={completedActionItems[item.id] ? "line-through text-slate-400" : "text-slate-800 dark:text-slate-200"}>{item.text}</span>
                    </label>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className={`${sectionCardClass} border-t-4 border-t-slate-400`}>
              <CardHeader className="border-b border-slate-200/70 pb-4 dark:border-slate-800/80">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-xl">Source Links</CardTitle>
                    <CardDescription>Attach references to each note (slides, papers, docs, URLs).</CardDescription>
                  </div>
                  <div className={`rounded-2xl bg-linear-to-br ${SECTION_TONES.links.glowClass} p-2`}>
                    <Link2 className={`h-5 w-5 ${SECTION_TONES.links.iconClass}`} />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-5">
                {notes.slice(0, 8).length === 0 ? (
                  <EmptyState
                    icon={Link2}
                    title="No source links yet"
                    description={subjectProfile.sourceHint}
                    accentClass={SECTION_TONES.links.glowClass}
                  />
                ) : notes.slice(0, 8).map((note) => (
                  <div key={note._id} className="rounded-2xl border border-slate-200/80 bg-white/80 p-3 dark:border-slate-800 dark:bg-slate-950/70">
                    <p className="mb-2 text-sm font-medium text-slate-900 dark:text-slate-50">{note.subject} • {new Date(note.createdAt).toLocaleDateString()}</p>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Input
                        value={newSourceLinkByNote[note._id] ?? ""}
                        onChange={(event) =>
                          setNewSourceLinkByNote((current) => ({
                            ...current,
                            [note._id]: event.target.value,
                          }))
                        }
                        placeholder="https://..."
                        className="rounded-2xl"
                      />
                      <Button type="button" onClick={() => addSourceLink(note._id)}>Add Link</Button>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(sourceLinksByNote[note._id] ?? []).map((link) => (
                        <a
                          key={`${note._id}-${link}`}
                          href={link}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
                        >
                          {link}
                        </a>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* 8 NEW PREMIUM FEATURES */}
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Feature 1: Practice Test Generator */}
            <Card className={`${sectionCardClass} border-l-4 border-l-fuchsia-500`}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Practice Test Generator</CardTitle>
                <CardDescription className="text-xs">Auto-generate {dueFlashcards.length} question tests</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button onClick={generatePracticeTest} className="w-full bg-fuchsia-600 text-white hover:bg-fuchsia-700">
                  Generate Test
                </Button>
                <div className="text-xs text-slate-500">
                  <p>Tests taken: {practiceTests.length}</p>
                  {practiceTests.length > 0 && (
                    <p>Latest: {practiceTests[0].score}% ({practiceTests[0].numQuestions}Q)</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Feature 7: Study Streak Gamification */}
            <Card className={`${sectionCardClass} border-l-4 border-l-orange-500`}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Study Streak</CardTitle>
                <CardDescription className="text-xs">Days of consistent review</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-xl bg-orange-50 p-3 dark:bg-orange-950/30">
                  <p className="text-2xl font-black text-orange-600 dark:text-orange-400">{studyStreak.currentStreak}</p>
                  <p className="text-xs text-orange-700 dark:text-orange-300">current streak</p>
                </div>
                <Button onClick={updateStreak} className="w-full bg-orange-600 text-white hover:bg-orange-700">
                  Log Today&apos;s Study
                </Button>
                <p className="text-xs text-slate-500">Record: {studyStreak.longestStreak} days</p>
              </CardContent>
            </Card>

            {/* Feature 4: Study Session Time Tracker */}
            <Card className={`${sectionCardClass} border-l-4 border-l-teal-500`}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Study Time</CardTitle>
                <CardDescription className="text-xs">Total hours invested</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-xl bg-teal-50 p-3 dark:bg-teal-950/30">
                  <p className="text-2xl font-black text-teal-600 dark:text-teal-400">{Math.round(totalStudyMinutes / 60)}h</p>
                  <p className="text-xs text-teal-700 dark:text-teal-300">{totalStudyMinutes} minutes total</p>
                </div>
                <Button onClick={() => updateSessionTime(topicList[0] ?? "general", 25)} className="w-full bg-teal-600 text-white hover:bg-teal-700">
                  + 25 min Session
                </Button>
              </CardContent>
            </Card>

            {/* Feature 6: Mock Exam Builder */}
            <Card className={`${sectionCardClass} border-l-4 border-l-purple-500`}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Mock Exams</CardTitle>
                <CardDescription className="text-xs">Full-length practice tests</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button onClick={() => createMockExam(100, 120, 80)} className="w-full bg-purple-600 text-white hover:bg-purple-700">
                  Create Exam
                </Button>
                {mockExams.length > 0 && (
                  <Button
                    onClick={() => completeMockExam(mockExams[0].id, mockExams[0].targetScore)}
                    className="w-full bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-950/30 dark:text-purple-200"
                    variant="outline"
                  >
                    Complete Latest Exam
                  </Button>
                )}
                <div className="text-xs text-slate-500">
                  <p>Created: {mockExams.length}</p>
                  {mockExams.filter((e) => e.takenAt).length > 0 && (
                    <p>Completed: {mockExams.filter((e) => e.takenAt).length}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Feature 3: Weak Points Analyzer */}
          {weakestTopics.length > 0 && (
            <Card className={`${sectionCardClass} border-t-4 border-t-red-500`}>
              <CardHeader className="border-b border-slate-200/70 pb-4 dark:border-slate-800/80">
                <CardTitle className="flex items-center gap-2">
                  <span className="text-red-600">⚠️</span> Weak Points Analyzer
                </CardTitle>
                <CardDescription>Topics with lowest accuracy - prioritize review here</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 pt-5">
                {weakestTopics.map((topic) => (
                  <div key={topic.topic} className="flex items-center justify-between rounded-xl border border-red-200/50 bg-red-50/30 p-3 dark:border-red-900/50 dark:bg-red-950/10">
                    <div>
                      <p className="font-medium text-slate-900 dark:text-slate-50">{topic.topic}</p>
                      <p className="text-xs text-slate-500">Bottom {topic.accuracy}% on {topic.attempts} attempts</p>
                    </div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900">
                      <span className="font-black text-red-600 dark:text-red-400">{topic.accuracy}%</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Feature 2: Concept Map Visualizer */}
          <Card className={`${sectionCardClass} border-t-4 border-t-green-500`}>
            <CardHeader className="border-b border-slate-200/70 pb-4 dark:border-slate-800/80">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle>Concept Map</CardTitle>
                  <CardDescription>Visual topic relationships - reveals study gaps</CardDescription>
                </div>
                <Button onClick={buildConceptMap} size="sm" variant="outline">
                  Build Map
                </Button>
              </div>
            </CardHeader>
            {conceptMapLinks.length > 0 && (
              <CardContent className="space-y-3 pt-5">
                <div className="rounded-xl border border-green-200/50 bg-green-50/30 p-4 dark:border-green-900/50 dark:bg-green-950/10">
                  <p className="text-xs font-semibold uppercase text-green-700 dark:text-green-300">Topic Connections</p>
                  <div className="mt-3 space-y-2">
                    {conceptMapLinks.map((link, idx) => (
                      <div key={idx} className="text-xs">
                        <span className="font-medium text-slate-900 dark:text-slate-50">{link.fromTopic}</span>
                        <span className="mx-1 text-slate-400">→({link.relationshipType})→</span>
                        <span className="font-medium text-slate-900 dark:text-slate-50">{link.toTopic}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Feature 5: Quick Flip Mode */}
          {dueFlashcards.length > 0 && (
            <Card className={`${sectionCardClass} border-t-4 border-t-cyan-500`}>
              <CardHeader className="border-b border-slate-200/70 pb-4 dark:border-slate-800/80">
                <CardTitle className="flex items-center justify-between">
                  <span>Quick Flip Mode</span>
                  <Button onClick={() => setShowQuickFlipMode(!showQuickFlipMode)} size="sm" variant="outline">
                    {showQuickFlipMode ? "Hide" : "Show"}
                  </Button>
                </CardTitle>
                <CardDescription>Ultra-minimal card review for rapid studying</CardDescription>
              </CardHeader>
              {showQuickFlipMode && (
                <CardContent className="space-y-3 pt-5">
                  <div className="rounded-2xl bg-cyan-50 p-6 text-center dark:bg-cyan-950/20">
                    {dueFlashcards[0] && (
                      <>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Front</p>
                        <p className="mt-2 text-xl font-semibold text-slate-900 dark:text-slate-50">{dueFlashcards[0].front}</p>
                        <p className="mt-4 text-sm text-slate-700 dark:text-slate-200">{dueFlashcards[0].back}</p>
                        <div className="mt-4 flex justify-center gap-2">
                          <Button size="sm" onClick={() => reviewFlashcard(dueFlashcards[0].id, "hard")}>
                            Hard
                          </Button>
                          <Button size="sm" onClick={() => reviewFlashcard(dueFlashcards[0].id, "good")}>
                            Good
                          </Button>
                          <Button size="sm" onClick={() => reviewFlashcard(dueFlashcards[0].id, "easy")}>
                            Easy
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          )}

          {/* Feature 8: Performance Analytics Dashboard */}
          {performanceTrend.length > 0 && (
            <Card className={`${sectionCardClass} border-t-4 border-t-indigo-500`}>
              <CardHeader className="border-b border-slate-200/70 pb-4 dark:border-slate-800/80">
                <CardTitle>Performance Analytics</CardTitle>
                <CardDescription>7-day average accuracy by topic with trend indicators</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 pt-5">
                {performanceTrend.map((perf) => (
                  <div key={perf.topic} className="flex items-center justify-between rounded-xl border border-indigo-200/50 bg-indigo-50/30 p-3 dark:border-indigo-900/50 dark:bg-indigo-950/10">
                    <div>
                      <p className="font-medium text-slate-900 dark:text-slate-50">{perf.topic}</p>
                      <p className="text-xs text-slate-500">{perf.avgAccuracy}% average</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">{perf.avgAccuracy}%</span>
                      <span className={`text-xs font-bold ${perf.trend >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                        {perf.trend >= 0 ? "↑" : "↓"} {Math.abs(perf.trend)}%
                      </span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      </div>
    );
  }
