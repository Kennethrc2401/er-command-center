"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mic, StopCircle, BookmarkPlus } from "lucide-react";
import { toast } from "sonner";
import { extractTopicsFromTranscription } from "@/lib/helpers/academicAI";

const RECORDING_DRAFT_STORAGE_KEY = "study-notes:recording-draft";

type MarkerType = "Exam" | "Definition" | "Formula" | "Action Item" | "General";

type ClassModePreset = {
  id: string;
  label: string;
  subjectHint: string;
  defaultClassName: string;
  defaultMarkerLabel: string;
  defaultMarkerType: MarkerType;
  autoPauseThresholdSeconds: number;
  preferredExportFormat: "markdown" | "txt";
};

const CLASS_MODE_PRESETS: ClassModePreset[] = [
  {
    id: "med-lecture",
    label: "Med Lecture",
    subjectHint: "Medicine / Nursing",
    defaultClassName: "Clinical Lecture",
    defaultMarkerLabel: "Exam hint",
    defaultMarkerType: "Exam",
    autoPauseThresholdSeconds: 150,
    preferredExportFormat: "markdown",
  },
  {
    id: "formula-heavy",
    label: "Formula Heavy",
    subjectHint: "Math / Physics / Engineering",
    defaultClassName: "Problem-Solving Session",
    defaultMarkerLabel: "Formula",
    defaultMarkerType: "Formula",
    autoPauseThresholdSeconds: 120,
    preferredExportFormat: "markdown",
  },
  {
    id: "review-session",
    label: "Review Session",
    subjectHint: "Exam Review",
    defaultClassName: "Exam Review",
    defaultMarkerLabel: "Action item",
    defaultMarkerType: "Action Item",
    autoPauseThresholdSeconds: 90,
    preferredExportFormat: "txt",
  },
];

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort?: () => void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

type SpeechRecognitionAlternativeLike = {
  transcript: string;
};

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternativeLike;
};

type SpeechRecognitionResultEventLike = {
  resultIndex: number;
  results: SpeechRecognitionResultLike[];
};

type SpeechRecognitionErrorEventLike = {
  error: string;
};

type RecordingMarker = {
  label: string;
  markerType: MarkerType;
  elapsedSeconds: number;
  createdAt: number;
};

interface RecordingInterfaceProps {
  subject: string;
  userId: Id<"users">;
  isRecording: boolean;
  setIsRecording: (recording: boolean) => void;
}

export default function RecordingInterface({
  subject,
  userId,
  isRecording,
  setIsRecording,
}: RecordingInterfaceProps) {
  const defaultPreset = CLASS_MODE_PRESETS[0];
  const [className, setClassName] = useState(`${subject} Class`);
  const [professor, setProfessor] = useState("");
  const [selectedPresetId, setSelectedPresetId] = useState<string>(defaultPreset.id);
  const [autoPauseThresholdSeconds, setAutoPauseThresholdSeconds] = useState<number>(defaultPreset.autoPauseThresholdSeconds);
  const [preferredExportFormat, setPreferredExportFormat] = useState<"markdown" | "txt">(defaultPreset.preferredExportFormat);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [transcription, setTranscription] = useState("");
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingMarkers, setRecordingMarkers] = useState<RecordingMarker[]>([]);
  const [markerLabel, setMarkerLabel] = useState(defaultPreset.defaultMarkerLabel);
  const [markerType, setMarkerType] = useState<MarkerType>(defaultPreset.defaultMarkerType);
  const [lastSpeechAt, setLastSpeechAt] = useState(0);
  const [lastAudioActivityAt, setLastAudioActivityAt] = useState(0);
  const [pauseStartedAt, setPauseStartedAt] = useState<number | null>(null);
  const [pauseSeconds, setPauseSeconds] = useState(0);
  const [audioQuality, setAudioQuality] = useState<"Good" | "Fair" | "Poor" | "Unknown">("Unknown");
  const [hasRecoverableDraft, setHasRecoverableDraft] = useState(() => {
    if (typeof window === "undefined") return false;
    const raw = window.localStorage.getItem(RECORDING_DRAFT_STORAGE_KEY);
    if (!raw) return false;

    try {
      const parsed = JSON.parse(raw) as { transcription?: string };
      return Boolean(parsed?.transcription);
    } catch {
      return false;
    }
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const recognitionRestartTimeoutRef = useRef<number | NodeJS.Timeout | null>(null);
  const recognitionShouldRunRef = useRef(false);
  const isRecordingRef = useRef(false);
  const isPausedRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const qualityIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const createSession = useMutation(api.academicScribe.createStudySession);
  const endSession = useMutation(api.academicScribe.endStudySession);
  const createNote = useMutation(api.academicScribe.createStudyNote);
  const discardSession = useMutation(api.academicScribe.discardStudySession);

  const startTimer = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }

    timerIntervalRef.current = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }, []);

  const stopAudioMeter = useCallback(() => {
    if (qualityIntervalRef.current) {
      clearInterval(qualityIntervalRef.current);
      qualityIntervalRef.current = null;
    }

    if (audioContextRef.current) {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }

    analyserRef.current = null;
    setAudioQuality("Unknown");
  }, []);

  const clearRecognitionRestart = useCallback(() => {
    if (recognitionRestartTimeoutRef.current) {
      clearTimeout(recognitionRestartTimeoutRef.current);
      recognitionRestartTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  const startRecognition = useCallback((allowRetry = true) => {
    const recognition = recognitionRef.current;
    if (!recognition || !recognitionShouldRunRef.current || !isRecordingRef.current || isPausedRef.current) {
      return false;
    }

    try {
      recognition.start();
      return true;
    } catch (error) {
      const errorName = error instanceof DOMException ? error.name : "";
      if (allowRetry && errorName === "InvalidStateError") {
        clearRecognitionRestart();
        recognitionRestartTimeoutRef.current = window.setTimeout(() => {
          void startRecognition(false);
        }, 300);
      }
      return false;
    }
  }, [clearRecognitionRestart]);

  const stopRecognition = useCallback(() => {
    recognitionShouldRunRef.current = false;
    clearRecognitionRestart();

    try {
      recognitionRef.current?.stop();
    } catch {
      // Speech recognition may already be stopping or stopped.
    }
  }, [clearRecognitionRestart]);

  const startAudioMeter = useCallback((stream: MediaStream) => {
    try {
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      qualityIntervalRef.current = setInterval(() => {
        if (!analyserRef.current) return;
        const buffer = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(buffer);
        const avg = buffer.reduce((sum, value) => sum + value, 0) / buffer.length;

        if (avg > 10) {
          setLastAudioActivityAt(Date.now());
        }

        if (avg > 28) {
          setAudioQuality("Good");
        } else if (avg > 14) {
          setAudioQuality("Fair");
        } else {
          setAudioQuality("Poor");
        }
      }, 2000);
    } catch {
      setAudioQuality("Unknown");
    }
  }, []);

  const applyClassPreset = useCallback((presetId: string) => {
    const preset = CLASS_MODE_PRESETS.find((item) => item.id === presetId);
    if (!preset) return;

    setSelectedPresetId(preset.id);
    setClassName(preset.defaultClassName);
    setMarkerLabel(preset.defaultMarkerLabel);
    setMarkerType(preset.defaultMarkerType);
    setAutoPauseThresholdSeconds(preset.autoPauseThresholdSeconds);
    setPreferredExportFormat(preset.preferredExportFormat);

    if (typeof window !== "undefined") {
      window.localStorage.setItem("study-notes:preferred-export-format", preset.preferredExportFormat);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !isRecording) return;

    const intervalId = window.setInterval(() => {
      const payload = {
        className,
        professor,
        markerLabel,
        markerType,
        selectedPresetId,
        autoPauseThresholdSeconds,
        preferredExportFormat,
        transcription,
        elapsedTime,
        recordingMarkers,
        pauseSeconds,
        updatedAt: Date.now(),
      };
      window.localStorage.setItem(RECORDING_DRAFT_STORAGE_KEY, JSON.stringify(payload));
    }, 20000);

    return () => window.clearInterval(intervalId);
  }, [
    isRecording,
    className,
    professor,
    markerLabel,
    markerType,
    selectedPresetId,
    autoPauseThresholdSeconds,
    preferredExportFormat,
    transcription,
    elapsedTime,
    recordingMarkers,
    pauseSeconds,
  ]);

  // Initialize Web Speech API
  useEffect(() => {
    const browserWindow = window as Window & {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    const SpeechRecognitionCtor =
      browserWindow.SpeechRecognition || browserWindow.webkitSpeechRecognition;
    if (SpeechRecognitionCtor) {
      recognitionRef.current = new SpeechRecognitionCtor() as unknown as SpeechRecognitionLike;
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = "en-US";

      recognitionRef.current.onstart = () => {
        setLastSpeechAt(Date.now());
      };

      recognitionRef.current.onend = () => {
        if (recognitionShouldRunRef.current && isRecordingRef.current && !isPausedRef.current) {
          clearRecognitionRestart();
          recognitionRestartTimeoutRef.current = window.setTimeout(() => {
            void startRecognition(false);
          }, 300);
        }
      };

      recognitionRef.current.onresult = (event: SpeechRecognitionResultEventLike) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (transcript.trim()) {
            setLastSpeechAt(Date.now());
          }

          if (event.results[i].isFinal) {
            setTranscription((prev) => prev + transcript + " ");
          }
        }
      };

      recognitionRef.current.onerror = (event: SpeechRecognitionErrorEventLike) => {
        if (event.error === "no-speech" || event.error === "aborted") {
          return;
        }

        console.error("Speech recognition error:", event.error);
        toast.error(`Transcription error: ${event.error}`);
      };
    }
  }, [clearRecognitionRestart, startRecognition]);

  const startRecording = async () => {
    try {
      // Create session in backend
      const newSessionId = await createSession({
        userId,
        subject,
        className,
        professor: professor || undefined,
      });
      setSessionId(newSessionId);

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Start media recording
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        if (recognitionShouldRunRef.current && isRecordingRef.current && !isPausedRef.current) {
          toast.message("Audio capture ended unexpectedly. You can restart the session if needed.");
        }
      };

      mediaRecorder.start();
      startAudioMeter(stream);

      // Start speech-to-text
      recognitionShouldRunRef.current = true;
      clearRecognitionRestart();
      void startRecognition();

      setIsRecording(true);
      setIsPaused(false);
      setRecordingMarkers([]);
      setPauseStartedAt(null);
      setPauseSeconds(0);
      setLastSpeechAt(Date.now());
      setLastAudioActivityAt(Date.now());
      setElapsedTime(0);
      setTranscription("");
      setHasRecoverableDraft(false);

      // Start timer
      startTimer();

      toast.success("Recording started");
    } catch {
      toast.error("Failed to start recording");
    }
  };

  const restoreDraft = () => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(RECORDING_DRAFT_STORAGE_KEY);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as {
        className?: string;
        professor?: string;
        markerLabel?: string;
        markerType?: MarkerType;
        selectedPresetId?: string;
        autoPauseThresholdSeconds?: number;
        preferredExportFormat?: "markdown" | "txt";
        transcription?: string;
        elapsedTime?: number;
        recordingMarkers?: RecordingMarker[];
        pauseSeconds?: number;
      };

      if (parsed.className) setClassName(parsed.className);
      if (parsed.professor) setProfessor(parsed.professor);
      if (parsed.markerLabel) setMarkerLabel(parsed.markerLabel);
      if (parsed.markerType) setMarkerType(parsed.markerType);
      if (parsed.selectedPresetId) setSelectedPresetId(parsed.selectedPresetId);
      if (parsed.autoPauseThresholdSeconds) setAutoPauseThresholdSeconds(parsed.autoPauseThresholdSeconds);
      if (parsed.preferredExportFormat) setPreferredExportFormat(parsed.preferredExportFormat);
      if (parsed.transcription) setTranscription(parsed.transcription);
      if (parsed.elapsedTime) setElapsedTime(parsed.elapsedTime);
      if (parsed.recordingMarkers) setRecordingMarkers(parsed.recordingMarkers);
      if (parsed.pauseSeconds) setPauseSeconds(parsed.pauseSeconds);

      toast.success("Recovered your last recording draft.");
      setHasRecoverableDraft(false);
    } catch {
      toast.error("Could not restore draft.");
    }
  };

  const clearDraft = () => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(RECORDING_DRAFT_STORAGE_KEY);
    setHasRecoverableDraft(false);
  };

  const pauseRecording = useCallback(async () => {
    if (!mediaRecorderRef.current || !recognitionRef.current || !sessionId) return;

    try {
      recognitionShouldRunRef.current = false;
      clearRecognitionRestart();

      if (mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.pause();
      }

      stopRecognition();
      stopTimer();
      setPauseStartedAt(Date.now());
      setIsPaused(true);
      toast.info("Recording paused");
    } catch {
      toast.error("Failed to pause recording");
    }
  }, [clearRecognitionRestart, sessionId, stopRecognition, stopTimer]);

  const resumeRecording = useCallback(async () => {
    if (!mediaRecorderRef.current || !recognitionRef.current || !sessionId) return;

    try {
      recognitionShouldRunRef.current = true;

      if (mediaRecorderRef.current.state === "paused") {
        mediaRecorderRef.current.resume();
      }

      clearRecognitionRestart();
      void startRecognition();
      if (pauseStartedAt) {
        setPauseSeconds((current) => current + Math.max(0, Math.round((Date.now() - pauseStartedAt) / 1000)));
      }
      setPauseStartedAt(null);
      startTimer();
      setIsPaused(false);
      toast.success("Recording resumed");
    } catch {
      toast.error("Failed to resume recording");
    }
  }, [clearRecognitionRestart, pauseStartedAt, sessionId, startRecognition, startTimer]);

  const stopRecording = async () => {
    if (!mediaRecorderRef.current || !sessionId) return;

    try {
      recognitionShouldRunRef.current = false;
      clearRecognitionRestart();

      // Stop media recorder
      if (mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());

      // Stop speech recognition
      stopRecognition();

      // Stop timer
      stopTimer();
      stopAudioMeter();

      setIsRecording(false);
      setIsPaused(false);

      // End session
      await endSession({
        sessionId: sessionId as Id<"studyClassSessions">,
        durationMinutes: Math.max(1, Math.round((elapsedTime - pauseSeconds) / 60)),
      });

      // Create note with transcription
      if (transcription.trim()) {
        const { topics } = extractTopicsFromTranscription(transcription, subject);

        setIsTranscribing(true);
        await createNote({
          sessionId: sessionId as Id<"studyClassSessions">,
          userId,
          rawTranscription: transcription,
          subject,
          topics,
          recordingMarkers,
          transcriptStats: {
            totalSeconds: elapsedTime,
            pauseSeconds: pauseSeconds + (pauseStartedAt ? Math.max(0, Math.round((Date.now() - pauseStartedAt) / 1000)) : 0),
            markerCount: recordingMarkers.length,
          },
        });

        setIsTranscribing(false);
        toast.success(
          `Study note created with ${topics.length} topics identified`
        );

        // Reset form
        setTranscription("");
        setSessionId(null);
        clearDraft();
      } else {
        toast.error("No transcription captured");
      }
    } catch {
      toast.error("Failed to stop recording");
    } finally {
      setIsRecording(false);
      setIsPaused(false);
    }
  };

  const discardRecording = async () => {
    if (!mediaRecorderRef.current || !sessionId) return;

    try {
      recognitionShouldRunRef.current = false;
      clearRecognitionRestart();

      if (mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());

      stopRecognition();

      stopTimer();
      stopAudioMeter();

      await discardSession({
        sessionId: sessionId as Id<"studyClassSessions">,
      });

      setIsRecording(false);
      setIsPaused(false);
      setTranscription("");
      setRecordingMarkers([]);
      setPauseStartedAt(null);
      setPauseSeconds(0);
      setLastSpeechAt(0);
      setElapsedTime(0);
      setSessionId(null);
      clearDraft();

      toast.info("Recording discarded and reset.");
    } catch {
      toast.error("Failed to discard recording");
    } finally {
      setIsRecording(false);
      setIsPaused(false);
    }
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const addMarker = (label: string) => {
    const trimmed = label.trim();
    if (!trimmed) return;

    setRecordingMarkers((current) => [
      ...current,
      {
        label: trimmed,
        markerType,
        elapsedSeconds: elapsedTime,
        createdAt: Date.now(),
      },
    ]);
    toast.success(`Marker added at ${formatTime(elapsedTime)}`);
  };

  useEffect(() => {
    if (!isRecording || isPaused) return;

    const lastActivityAt = Math.max(lastSpeechAt, lastAudioActivityAt);
    if (!lastActivityAt) return;

    const silenceThresholdSeconds = autoPauseThresholdSeconds;
    const silentFor = Math.max(0, Date.now() - lastActivityAt) / 1000;
    const timeoutId = window.setTimeout(() => {
      void pauseRecording();
      toast.message("Auto-paused after extended silence. Resume when you are ready.");
    }, Math.max(0, (silenceThresholdSeconds - silentFor) * 1000));

    return () => window.clearTimeout(timeoutId);
  }, [elapsedTime, isRecording, isPaused, lastSpeechAt, lastAudioActivityAt, autoPauseThresholdSeconds, pauseRecording]);

  useEffect(() => {
    return () => {
      recognitionShouldRunRef.current = false;
      clearRecognitionRestart();
      stopTimer();
      stopAudioMeter();

      try {
        recognitionRef.current?.stop();
      } catch {
        // Ignore cleanup errors.
      }

      const mediaRecorder = mediaRecorderRef.current;
      if (mediaRecorder && mediaRecorder.state !== "inactive") {
        try {
          mediaRecorder.stop();
        } catch {
          // Ignore cleanup errors.
        }
      }

      mediaRecorder?.stream.getTracks().forEach((track) => track.stop());
    };
  }, [clearRecognitionRestart, stopAudioMeter, stopTimer]);

  return (
    <div className="space-y-4">
      {hasRecoverableDraft && !isRecording && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
          <CardContent className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-amber-900 dark:text-amber-100">A previous draft was found from an interrupted session.</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={clearDraft}>Dismiss</Button>
              <Button size="sm" onClick={restoreDraft}>Restore Draft</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!isRecording && (
        <Card className="border-cyan-200 bg-cyan-50/70 dark:border-cyan-900 dark:bg-cyan-950/30">
          <CardContent className="space-y-3 pt-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-semibold text-cyan-900 dark:text-cyan-100">Class Mode Preset</p>
              <Badge variant="secondary">Preferred Export: {preferredExportFormat.toUpperCase()}</Badge>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium">Preset</label>
                <select
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                  value={selectedPresetId}
                  onChange={(event) => applyClassPreset(event.target.value)}
                >
                  {CLASS_MODE_PRESETS.map((preset) => (
                    <option key={preset.id} value={preset.id}>{preset.label} ({preset.subjectHint})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Auto-Pause (seconds)</label>
                <Input
                  type="number"
                  min={30}
                  max={300}
                  value={autoPauseThresholdSeconds}
                  onChange={(event) => setAutoPauseThresholdSeconds(Math.max(30, Math.min(300, Number(event.target.value) || 120)))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Default Marker Type</label>
                <select
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                  value={markerType}
                  onChange={(event) => setMarkerType(event.target.value as MarkerType)}
                >
                  {(["Exam", "Definition", "Formula", "Action Item", "General"] as MarkerType[]).map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Session Setup */}
      {!isRecording && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Class Name</label>
            <Input
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              placeholder="e.g., Linear Algebra Lecture"
              disabled={isRecording}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Professor</label>
            <Input
              value={professor}
              onChange={(e) => setProfessor(e.target.value)}
              placeholder="Optional"
              disabled={isRecording}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Subject</label>
            <Badge variant="secondary" className="mt-2">
              {subject}
            </Badge>
          </div>
        </div>
      )}

      {/* Recording Control */}
      <Card className="bg-linear-to-r from-blue-50 to-indigo-50 dark:from-blue-900 dark:to-indigo-900 border-blue-200 dark:border-blue-800">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-center flex-1">
              {isRecording ? (
                <div className="flex items-center justify-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${isPaused ? "bg-amber-500" : "bg-red-500 animate-pulse"}`} />
                  <span className="text-2xl font-mono font-bold">
                    {formatTime(elapsedTime)}
                  </span>
                </div>
              ) : (
                <span className="text-slate-600 dark:text-slate-400">
                  Ready to record
                </span>
              )}
            </div>
          </div>

          {isRecording && (
            <div className="mb-4 p-3 bg-white dark:bg-slate-800 rounded-lg border-l-4 border-blue-500">
              <p className="text-sm font-medium mb-2">Live Transcription:</p>
              <p className="text-sm text-slate-600 dark:text-slate-300 italic">
                {isPaused ? "Paused for break" : transcription || "Listening..."}
              </p>
            </div>
          )}

          {isRecording && (
            <div className="mb-4 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  value={markerLabel}
                  onChange={(event) => setMarkerLabel(event.target.value)}
                  placeholder="Marker label"
                  className="sm:flex-1"
                />
                  <select
                    className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                    value={markerType}
                    onChange={(event) => setMarkerType(event.target.value as MarkerType)}
                  >
                    {(["Exam", "Definition", "Formula", "Action Item", "General"] as MarkerType[]).map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                <Button type="button" variant="outline" onClick={() => addMarker(markerLabel)} className="gap-2">
                  <BookmarkPlus className="h-4 w-4" />
                  Add Marker
                </Button>
              </div>
              {recordingMarkers.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {recordingMarkers.map((marker) => (
                    <Badge key={`${marker.createdAt}-${marker.elapsedSeconds}`} variant="secondary" className="gap-1">
                      <span>{formatTime(marker.elapsedSeconds)}</span>
                      <span>•</span>
                      <span>{marker.markerType}</span>
                      <span>•</span>
                      <span>{marker.label}</span>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2">
            {!isRecording ? (
              <Button
                onClick={startRecording}
                size="lg"
                className="flex-1 gap-2"
                disabled={isTranscribing}
              >
                <Mic className="w-5 h-5" />
                Start Recording
              </Button>
            ) : (
              <>
                <Button
                  onClick={isPaused ? resumeRecording : pauseRecording}
                  size="lg"
                  variant={isPaused ? "default" : "outline"}
                  className="flex-1 gap-2"
                >
                  <Mic className="w-5 h-5" />
                  {isPaused ? "Resume Recording" : "Pause Recording"}
                </Button>
                <Button
                  onClick={stopRecording}
                  size="lg"
                  variant="destructive"
                  className="flex-1 gap-2"
                >
                  <StopCircle className="w-5 h-5" />
                  Stop Recording
                </Button>
                <Button
                  onClick={discardRecording}
                  size="lg"
                  variant="outline"
                  className="flex-1 gap-2 border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/30"
                >
                  Reset
                </Button>
              </>
            )}
          </div>

          {isTranscribing && (
            <div className="mt-3 p-2 bg-blue-100 dark:bg-blue-900 rounded text-sm text-blue-800 dark:text-blue-200">
              Processing transcription...
            </div>
          )}

          {isRecording && isPaused && (
            <div className="mt-3 p-2 bg-amber-100 dark:bg-amber-950/30 rounded text-sm text-amber-800 dark:text-amber-200">
              Recording is paused. Resume when you return from break.
            </div>
          )}

          {isRecording && (
            <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-3">
              <p>Markers: {recordingMarkers.length}</p>
              <p>Paused time: {Math.max(0, pauseSeconds)}s</p>
              <p>Audio quality: {audioQuality}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tips */}
      <Card className="bg-slate-50 dark:bg-slate-800">
        <CardContent className="pt-6">
          <p className="text-sm font-semibold mb-2">💡 Recording Tips:</p>
          <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
            <li>• Speak clearly and at a natural pace</li>
            <li>• Topics will be automatically extracted from your recording</li>
            <li>• You can edit and organize the transcription after</li>
            <li>• Longer recordings get better topic organization</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
