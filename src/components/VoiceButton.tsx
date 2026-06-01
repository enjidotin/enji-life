"use client";

import { useRef, useState } from "react";
import { Loader2, Mic } from "lucide-react";
import { blobToWavBase64 } from "@/lib/wav";

type State = "idle" | "recording" | "processing";

// Hold to speak. On release, the recording is converted to WAV and handed back
// via onResult; the parent sends it to the meal parser.
export function VoiceButton({
  onResult,
  onError,
  disabled,
}: {
  onResult: (audioBase64: string) => void;
  onError: (message: string) => void;
  disabled?: boolean;
}) {
  const [state, setState] = useState<State>("idle");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const cancelRef = useRef(false); // released before recorder was ready
  const startingRef = useRef(false);

  async function start() {
    if (state !== "idle" || disabled || startingRef.current) return;
    startingRef.current = true;
    cancelRef.current = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      recorder.onstop = handleStop;
      recorderRef.current = recorder;
      recorder.start();
      setState("recording");
      if (cancelRef.current) recorder.stop(); // pointer already released
    } catch (err) {
      onError(
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Microphone permission denied."
          : "Couldn't access the microphone.",
      );
      setState("idle");
    } finally {
      startingRef.current = false;
    }
  }

  function stop() {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    } else {
      cancelRef.current = true;
    }
  }

  async function handleStop() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const type = chunksRef.current[0]?.type || "audio/webm";
    const blob = new Blob(chunksRef.current, { type });
    recorderRef.current = null;
    if (blob.size < 1024) {
      setState("idle"); // too short — treat as an accidental tap
      return;
    }
    setState("processing");
    try {
      const base64 = await blobToWavBase64(blob);
      onResult(base64);
    } catch {
      onError("Couldn't process the recording.");
    } finally {
      setState("idle");
    }
  }

  const busy = state === "processing";
  const recording = state === "recording";

  return (
    <button
      type="button"
      disabled={disabled || busy}
      onPointerDown={(e) => {
        e.preventDefault();
        void start();
      }}
      onPointerUp={stop}
      onPointerLeave={() => recording && stop()}
      onPointerCancel={stop}
      aria-label="Hold to speak your meal"
      title="Hold to speak"
      className={`flex h-9 select-none items-center justify-center gap-1.5 rounded-md border px-3 text-sm font-medium touch-none transition-colors disabled:opacity-60 ${
        recording
          ? "animate-pulse border-red-500 bg-red-500 text-white"
          : "border-neutral-300 text-neutral-700 hover:bg-neutral-50 active:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
      }`}
    >
      {busy ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Mic className="size-4" />
      )}
      <span>{recording ? "Listening…" : busy ? "Reading…" : "Speak"}</span>
    </button>
  );
}
