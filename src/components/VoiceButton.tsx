"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, Square } from "lucide-react";
import { blobToWavBase64 } from "@/lib/wav";

type State = "idle" | "recording" | "processing";

const MAX_RECORDING_MS = 90_000; // safety net if the user forgets to stop

// Tap to start, tap again to finish. The recording is converted to WAV and
// handed back via onResult; the parent sends it to the AI parser.
export function VoiceButton({
  onResult,
  onError,
  disabled,
  size = "sm",
  idleLabel,
}: {
  onResult: (audioBase64: string) => void;
  onError: (message: string) => void;
  disabled?: boolean;
  size?: "sm" | "lg";
  idleLabel?: string;
}) {
  const [state, setState] = useState<State>("idle");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const cancelRef = useRef(false); // stop tapped before recorder was ready
  const startingRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      recorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function start() {
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
      timeoutRef.current = setTimeout(stop, MAX_RECORDING_MS);
      if (cancelRef.current) recorder.stop(); // stop tapped while starting
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
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    } else {
      cancelRef.current = true;
    }
  }

  function toggle() {
    if (state === "recording") {
      stop();
    } else if (startingRef.current) {
      cancelRef.current = true;
    } else if (state === "idle" && !disabled) {
      void start();
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
  const lg = size === "lg";

  const label = recording
    ? "Listening… tap when done"
    : busy
      ? "Thinking…"
      : (idleLabel ?? (lg ? "Tap to speak" : "Speak"));
  const iconSize = lg ? "size-6" : "size-4";

  return (
    <button
      type="button"
      disabled={disabled || busy}
      onClick={toggle}
      aria-label={recording ? "Stop recording" : "Tap to speak"}
      title={recording ? "Tap to finish" : "Tap to speak"}
      className={`flex select-none items-center justify-center gap-2 rounded-xl border font-medium transition-colors disabled:opacity-60 ${
        lg ? "w-full py-4 text-base" : "h-9 rounded-md px-3 text-sm"
      } ${
        recording
          ? "animate-pulse border-red-500 bg-red-500 text-white"
          : lg
            ? "border-neutral-900 bg-neutral-900 text-white hover:bg-neutral-800 active:bg-neutral-700 dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
            : "border-neutral-300 text-neutral-700 hover:bg-neutral-50 active:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
      }`}
    >
      {busy ? (
        <Loader2 className={`${iconSize} animate-spin`} />
      ) : recording ? (
        <Square className={`${iconSize} fill-current`} />
      ) : (
        <Mic className={iconSize} />
      )}
      <span>{label}</span>
    </button>
  );
}
