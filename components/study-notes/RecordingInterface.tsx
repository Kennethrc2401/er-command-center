"use client";

import { useState, useRef, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mic, StopCircle } from "lucide-react";
import { toast } from "sonner";
import { extractTopicsFromTranscription } from "@/lib/helpers/academicAI";

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
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
  const [className, setClassName] = useState(`${subject} Class`);
  const [professor, setProfessor] = useState("");
  const [elapsedTime, setElapsedTime] = useState(0);
  const [transcription, setTranscription] = useState("");
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const createSession = useMutation(api.academicScribe.createStudySession);
  const endSession = useMutation(api.academicScribe.endStudySession);
  const createNote = useMutation(api.academicScribe.createStudyNote);

  const startTimer = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }

    timerIntervalRef.current = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  };

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

      recognitionRef.current.onresult = (event: SpeechRecognitionResultEventLike) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            setTranscription((prev) => prev + transcript + " ");
          }
        }
      };

      recognitionRef.current.onerror = (event: SpeechRecognitionErrorEventLike) => {
        console.error("Speech recognition error:", event.error);
        toast.error(`Transcription error: ${event.error}`);
      };
    }
  }, []);

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

      mediaRecorder.start();

      // Start speech-to-text
      if (recognitionRef.current) {
        recognitionRef.current.start();
      }

      setIsRecording(true);
      setIsPaused(false);
      setElapsedTime(0);
      setTranscription("");

      // Start timer
      startTimer();

      toast.success("Recording started");
    } catch {
      toast.error("Failed to start recording");
    }
  };

  const pauseRecording = async () => {
    if (!mediaRecorderRef.current || !recognitionRef.current || !sessionId) return;

    try {
      if (mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.pause();
      }

      recognitionRef.current.stop();
      stopTimer();
      setIsPaused(true);
      toast.info("Recording paused");
    } catch {
      toast.error("Failed to pause recording");
    }
  };

  const resumeRecording = async () => {
    if (!mediaRecorderRef.current || !recognitionRef.current || !sessionId) return;

    try {
      if (mediaRecorderRef.current.state === "paused") {
        mediaRecorderRef.current.resume();
      }

      recognitionRef.current.start();
      startTimer();
      setIsPaused(false);
      toast.success("Recording resumed");
    } catch {
      toast.error("Failed to resume recording");
    }
  };

  const stopRecording = async () => {
    if (!mediaRecorderRef.current || !sessionId) return;

    try {
      // Stop media recorder
      if (mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());

      // Stop speech recognition
      try {
        recognitionRef.current?.stop();
      } catch {
        // Speech recognition may already be stopped during pause.
      }

      // Stop timer
      stopTimer();

      setIsRecording(false);
      setIsPaused(false);

      // End session
      await endSession({
        sessionId: sessionId as Id<"studyClassSessions">,
        durationMinutes: Math.max(1, Math.round(elapsedTime / 60)),
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
        });

        setIsTranscribing(false);
        toast.success(
          `Study note created with ${topics.length} topics identified`
        );

        // Reset form
        setTranscription("");
        setSessionId(null);
      } else {
        toast.error("No transcription captured");
      }
    } catch {
      toast.error("Failed to stop recording");
    }
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-4">
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
