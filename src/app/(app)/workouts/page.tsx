"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { api } from "../../../../convex/_generated/api";
import { Doc, Id } from "../../../../convex/_generated/dataModel";
import {
  Card,
  PageHeader,
  dangerButtonClass,
  formatDate,
  inputClass,
} from "@/components/ui";
import { Button } from "@/components/ui/button";
import { SearchableCombobox } from "@/components/SearchableCombobox";
import { QuantityStepper } from "@/components/QuantityStepper";
import { VoiceButton } from "@/components/VoiceButton";
import { ExerciseDialog } from "@/components/ExerciseDialog";
import { Sparkles, X, RotateCcw, Clock, Plus, Timer } from "lucide-react";
import Link from "next/link";

type Exercise = Doc<"exercises">;
type WorkoutItem = Doc<"workouts">["items"][number];

type Draft = {
  key: number;
  exerciseId: Id<"exercises"> | null;
  name: string;
  category?: string;
  maxWeight: number; // 0 = unset
  totalReps: number; // 0 = unset
};

const chipClass =
  "inline-flex items-center gap-1.5 rounded-full border border-neutral-200 px-3.5 py-2 text-sm text-neutral-600 hover:border-neutral-400 hover:bg-neutral-50 active:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:border-neutral-500 dark:hover:bg-neutral-800";

const pillClass =
  "rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300";

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function WorkoutsPage() {
  const workouts = useQuery(api.workouts.list);
  const exercises = useQuery(api.exercises.list);
  const parseWorkout = useAction(api.ai.parseWorkout);
  const logItems = useMutation(api.workouts.logItems);
  const removeWorkout = useMutation(api.workouts.remove);

  const keyRef = useRef(0);
  const nextKey = () => ++keyRef.current;

  const [text, setText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [durationMinutes, setDurationMinutes] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [customTime, setCustomTime] = useState(false);
  const [whenValue, setWhenValue] = useState("");

  const [showText, setShowText] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showDuration, setShowDuration] = useState(false);
  const [showNotes, setShowNotes] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogInitialName, setDialogInitialName] = useState("");
  const pendingExerciseId = useRef<Id<"exercises"> | null>(null);

  function addDraft(d: Omit<Draft, "key">) {
    setDrafts((prev) => [...prev, { ...d, key: nextKey() }]);
  }
  function updateDraft(key: number, patch: Partial<Draft>) {
    setDrafts((prev) => prev.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  }
  function removeDraft(key: number) {
    setDrafts((prev) => prev.filter((d) => d.key !== key));
  }

  function addExercise(ex: Exercise) {
    addDraft({
      exerciseId: ex._id,
      name: ex.name,
      category: ex.category,
      maxWeight: 0,
      totalReps: 0,
    });
  }

  function addWorkoutItems(items: WorkoutItem[]) {
    items.forEach((it) =>
      addDraft({
        exerciseId: it.exerciseId,
        name: it.name,
        category: it.category,
        maxWeight: it.maxWeight ?? 0,
        totalReps: it.totalReps ?? 0,
      }),
    );
  }

  useEffect(() => {
    if (!pendingExerciseId.current || !exercises) return;
    const ex = exercises.find((e) => e._id === pendingExerciseId.current);
    if (ex) {
      addExercise(ex);
      pendingExerciseId.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercises]);

  async function runParse(input: {
    text?: string;
    audio?: { data: string; format: string };
  }) {
    setParsing(true);
    setParseError(null);
    try {
      const { items, durationMinutes: dur } = await parseWorkout(input);
      if (items.length === 0) {
        setParseError("Couldn't find any exercises in that. Try rephrasing.");
        return;
      }
      items.forEach((it) =>
        addDraft({
          exerciseId: null,
          name: it.name,
          category: it.category,
          maxWeight: it.maxWeight ?? 0,
          totalReps: it.totalReps ?? 0,
        }),
      );
      if (dur && !durationMinutes) {
        setDurationMinutes(String(dur));
        setShowDuration(true);
      }
      setText("");
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setParsing(false);
    }
  }

  function onEstimate() {
    const t = text.trim();
    if (!t) return;
    void runParse({ text: t });
  }

  function onVoice(audioBase64: string) {
    void runParse({
      text: text.trim() || undefined,
      audio: { data: audioBase64, format: "wav" },
    });
  }

  function enableCustomTime() {
    setWhenValue(toLocalInput(new Date()));
    setCustomTime(true);
  }

  async function onLog() {
    if (drafts.length === 0) return;
    setSubmitting(true);
    try {
      const performedAt =
        customTime && whenValue ? new Date(whenValue).getTime() : undefined;
      await logItems({
        items: drafts.map((d) => ({
          name: d.name,
          category: d.category,
          maxWeight: d.maxWeight > 0 ? d.maxWeight : undefined,
          totalReps: d.totalReps > 0 ? d.totalReps : undefined,
        })),
        durationMinutes: durationMinutes ? Number(durationMinutes) : undefined,
        notes: notes.trim() || undefined,
        performedAt,
      });
      setDrafts([]);
      setDurationMinutes("");
      setNotes("");
      setCustomTime(false);
      setWhenValue("");
      setShowText(false);
      setShowSearch(false);
      setShowDuration(false);
      setShowNotes(false);
    } finally {
      setSubmitting(false);
    }
  }

  const recentExercises = (exercises ?? []).slice(0, 12);

  return (
    <div className={drafts.length > 0 ? "pb-24 sm:pb-0" : undefined}>
      <div className="mb-5 flex items-start justify-between gap-3 sm:mb-6">
        <PageHeader
          title="Workouts"
          description="Say what you did — even “the usual chest day.”"
        />
        <Link
          href="/exercises"
          className="mt-1 shrink-0 text-sm text-neutral-500 underline-offset-4 hover:underline"
        >
          Manage exercises →
        </Link>
      </div>

      <Card className="mb-6">
        <div className="grid gap-4">
          {/* Voice-first entry */}
          <VoiceButton
            size="lg"
            onResult={onVoice}
            onError={setParseError}
            disabled={parsing}
          />

          {/* Type instead (secondary) */}
          {showText ? (
            <div className="grid gap-2">
              <textarea
                className={`${inputClass} min-h-[64px] w-full resize-none`}
                placeholder="e.g. the usual chest day, or: bench 80kg 5x5, incline press, cable flyes"
                value={text}
                onChange={(e) => setText(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") onEstimate();
                }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={onEstimate}
                disabled={!text.trim() || parsing}
              >
                <Sparkles className="mr-1.5 size-4" />
                {parsing ? "Reading…" : "Build workout"}
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowText(true)}
              className="text-center text-xs text-neutral-500 underline-offset-4 hover:underline"
            >
              or type it instead
            </button>
          )}

          {parseError && (
            <p className="text-xs text-red-600 dark:text-red-400">{parseError}</p>
          )}

          {/* Draft exercises */}
          {drafts.length > 0 && (
            <ul className="grid gap-2 border-t border-neutral-100 pt-4 dark:border-neutral-800">
              {drafts.map((d) => (
                <li
                  key={d.key}
                  className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-800"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{d.name}</div>
                      {d.category && (
                        <div className="truncate text-xs text-neutral-500">
                          {d.category}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeDraft(d.key)}
                      aria-label="Remove exercise"
                      className="-mr-1 -mt-1 flex size-9 shrink-0 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs text-neutral-500">Weight</span>
                      <QuantityStepper
                        value={d.maxWeight}
                        step={2.5}
                        onChange={(v) => updateDraft(d.key, { maxWeight: v })}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs text-neutral-500">Reps</span>
                      <QuantityStepper
                        value={d.totalReps}
                        onChange={(v) => updateDraft(d.key, { totalReps: v })}
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* Add from your exercises */}
          {(recentExercises.length > 0 || (exercises?.length ?? 0) > 0) && (
            <div className="grid gap-3 border-t border-neutral-100 pt-4 dark:border-neutral-800">
              {recentExercises.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {recentExercises.map((e) => (
                    <button
                      key={e._id}
                      type="button"
                      onClick={() => addExercise(e)}
                      className="rounded-full border border-neutral-200 px-3.5 py-2 text-sm text-neutral-700 hover:border-neutral-400 hover:bg-neutral-50 active:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:border-neutral-500 dark:hover:bg-neutral-800"
                    >
                      + {e.name}
                    </button>
                  ))}
                </div>
              )}
              {showSearch ? (
                <SearchableCombobox<Id<"exercises">>
                  items={(exercises ?? []).map((e) => ({
                    id: e._id,
                    label: e.name,
                    sublabel: e.category,
                    searchValue: `${e.name} ${e.category ?? ""}`,
                  }))}
                  value={null}
                  onSelect={(id) => {
                    const e = (exercises ?? []).find((x) => x._id === id);
                    if (e) addExercise(e);
                  }}
                  onCreateNew={(name) => {
                    setDialogInitialName(name);
                    setDialogOpen(true);
                  }}
                  placeholder="Search your exercises…"
                  emptyText="No matching exercise."
                  createLabel="Add a new exercise…"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setShowSearch(true)}
                  className="self-start text-xs text-neutral-500 underline-offset-4 hover:underline"
                >
                  Search all exercises…
                </button>
              )}
            </div>
          )}

          {/* Time + duration + notes */}
          <div className="flex flex-wrap items-center gap-2">
            {customTime ? (
              <div className="flex w-full flex-wrap items-center gap-2">
                <Clock className="size-4 text-neutral-400" />
                <input
                  type="datetime-local"
                  className={inputClass}
                  value={whenValue}
                  max={toLocalInput(new Date())}
                  onChange={(e) => setWhenValue(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setCustomTime(false)}
                  className="text-xs text-neutral-500 underline-offset-4 hover:underline"
                >
                  Use now
                </button>
              </div>
            ) : (
              <button type="button" onClick={enableCustomTime} className={chipClass}>
                <Clock className="size-3.5" />
                Now
              </button>
            )}
            {!showDuration && !durationMinutes && (
              <button
                type="button"
                onClick={() => setShowDuration(true)}
                className={chipClass}
              >
                <Timer className="size-3.5" />
                Duration
              </button>
            )}
            {!showNotes && !notes && (
              <button
                type="button"
                onClick={() => setShowNotes(true)}
                className={chipClass}
              >
                <Plus className="size-3.5" />
                Note
              </button>
            )}
          </div>
          {(showDuration || durationMinutes) && (
            <input
              className={inputClass}
              type="number"
              inputMode="numeric"
              min="0"
              placeholder="Duration (minutes)"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
            />
          )}
          {(showNotes || notes) && (
            <input
              className={inputClass}
              placeholder="Notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          )}

          {/* Inline log (desktop; mobile uses the sticky bar) */}
          <Button
            type="button"
            onClick={onLog}
            disabled={drafts.length === 0 || submitting}
            className="hidden sm:flex"
          >
            {submitting ? "Logging…" : "Log workout"}
          </Button>
        </div>
      </Card>

      <Card>
        {workouts === undefined ? (
          <p className="text-sm text-neutral-400">Loading…</p>
        ) : workouts.length === 0 ? (
          <p className="text-sm text-neutral-400">No workouts yet.</p>
        ) : (
          <ul className="divide-y divide-neutral-100 text-sm dark:divide-neutral-800">
            {workouts.map((w) => (
              <li key={w._id} className="py-3">
                <div className="font-medium">
                  {w.items.map((it) => it.name).join(" + ") || "Workout"}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-neutral-500">
                  <span>{formatDate(w.performedAt)}</span>
                  {w.durationMinutes != null && (
                    <span className={pillClass}>{w.durationMinutes} min</span>
                  )}
                </div>
                <ul className="mt-1.5 space-y-0.5 text-xs text-neutral-500">
                  {w.items.map((it, i) => (
                    <li key={i}>
                      {it.name}
                      {it.maxWeight != null && ` · ${it.maxWeight} max`}
                      {it.totalReps != null && ` · ${it.totalReps} reps`}
                    </li>
                  ))}
                </ul>
                {w.notes && (
                  <div className="mt-1 text-xs text-neutral-500">{w.notes}</div>
                )}
                <div className="mt-2.5 flex gap-2">
                  <button
                    onClick={() => addWorkoutItems(w.items)}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-neutral-200 py-2 text-xs font-medium text-neutral-700 hover:border-neutral-400 hover:bg-neutral-50 active:bg-neutral-100 sm:flex-none sm:px-3 dark:border-neutral-700 dark:text-neutral-200 dark:hover:border-neutral-600 dark:hover:bg-neutral-800"
                  >
                    <RotateCcw className="size-3.5" />
                    Repeat
                  </button>
                  <button
                    onClick={() => removeWorkout({ id: w._id })}
                    className={dangerButtonClass}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ExerciseDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialName={dialogInitialName}
        onCreated={(id) => {
          pendingExerciseId.current = id;
        }}
      />

      {/* Sticky log bar (mobile only) */}
      {drafts.length > 0 && (
        <div
          className="fixed inset-x-0 z-30 border-t border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur sm:hidden dark:border-neutral-800 dark:bg-neutral-950/95"
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 3.5rem)" }}
        >
          <Button
            type="button"
            onClick={onLog}
            disabled={submitting}
            className="h-12 w-full text-base"
          >
            {submitting
              ? "Logging…"
              : `Log workout · ${drafts.length} exercise${drafts.length === 1 ? "" : "s"}`}
          </Button>
        </div>
      )}
    </div>
  );
}
