"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import {
  Card,
  PageHeader,
  dangerButtonClass,
  formatDate,
  inputClass,
} from "@/components/ui";
import { Button } from "@/components/ui/button";
import { ExerciseCombobox } from "@/components/ExerciseCombobox";
import { ExerciseDialog } from "@/components/ExerciseDialog";
import { Plus, X } from "lucide-react";
import Link from "next/link";

type Row = {
  exerciseId: Id<"exercises"> | null;
  maxWeight: string;
  totalReps: string;
};

const emptyRow: Row = { exerciseId: null, maxWeight: "", totalReps: "" };

export default function WorkoutsPage() {
  const workouts = useQuery(api.workouts.list);
  const exercises = useQuery(api.exercises.list);
  const addWorkout = useMutation(api.workouts.add);
  const removeWorkout = useMutation(api.workouts.remove);

  const [rows, setRows] = useState<Row[]>([{ ...emptyRow }]);
  const [durationMinutes, setDurationMinutes] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogInitialName, setDialogInitialName] = useState("");
  const [targetRowIdx, setTargetRowIdx] = useState<number | null>(null);

  function updateRow(idx: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }
  function addRow() {
    setRows((prev) => [...prev, { ...emptyRow }]);
  }
  function removeRow(idx: number) {
    setRows((prev) =>
      prev.length === 1 ? [{ ...emptyRow }] : prev.filter((_, i) => i !== idx),
    );
  }

  function openCreateExercise(rowIdx: number, initialName: string) {
    setTargetRowIdx(rowIdx);
    setDialogInitialName(initialName);
    setDialogOpen(true);
  }

  function onExerciseCreated(id: Id<"exercises">) {
    if (targetRowIdx != null) {
      updateRow(targetRowIdx, { exerciseId: id });
      setTargetRowIdx(null);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const items = rows
      .filter((r) => r.exerciseId)
      .map((r) => ({
        exerciseId: r.exerciseId as Id<"exercises">,
        maxWeight: r.maxWeight ? Number(r.maxWeight) : undefined,
        totalReps: r.totalReps ? Number(r.totalReps) : undefined,
      }));
    if (items.length === 0) return;
    setSubmitting(true);
    try {
      await addWorkout({
        items,
        durationMinutes: durationMinutes ? Number(durationMinutes) : undefined,
        notes: notes.trim() || undefined,
      });
      setRows([{ ...emptyRow }]);
      setDurationMinutes("");
      setNotes("");
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = rows.some((r) => r.exerciseId);

  return (
    <div>
      <div className="mb-5 flex items-start justify-between gap-3 sm:mb-6">
        <PageHeader
          title="Workouts"
          description="Log a session as a list of exercises with max weight and total reps."
        />
        <Link
          href="/exercises"
          className="mt-1 shrink-0 text-sm text-neutral-500 underline-offset-4 hover:underline"
        >
          Manage exercises →
        </Link>
      </div>

      <Card className="mb-6">
        <form onSubmit={onSubmit} className="grid gap-3">
          {rows.map((row, idx) => (
            <div
              key={idx}
              className="grid grid-cols-2 items-center gap-2 sm:grid-cols-[1fr_110px_110px_auto]"
            >
              <div className="col-span-1 min-w-0 sm:col-span-1">
                <ExerciseCombobox
                  exercises={exercises ?? []}
                  value={row.exerciseId}
                  onSelect={(id) => updateRow(idx, { exerciseId: id })}
                  onCreateNew={(name) => openCreateExercise(idx, name)}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeRow(idx)}
                aria-label="Remove row"
                className="justify-self-end sm:order-last sm:justify-self-auto"
              >
                <X className="size-4" />
              </Button>
              <input
                className={inputClass}
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                placeholder="Max wt"
                value={row.maxWeight}
                onChange={(e) =>
                  updateRow(idx, { maxWeight: e.target.value })
                }
              />
              <input
                className={inputClass}
                type="number"
                inputMode="numeric"
                min="0"
                placeholder="Total reps"
                value={row.totalReps}
                onChange={(e) =>
                  updateRow(idx, { totalReps: e.target.value })
                }
              />
            </div>
          ))}

          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addRow}
            >
              <Plus className="mr-1 size-4" />
              Add exercise
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <input
              className={inputClass}
              type="number"
              inputMode="numeric"
              min="0"
              placeholder="Duration (min)"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
            />
            <input
              className={`${inputClass} sm:col-span-2`}
              placeholder="Notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <Button type="submit" disabled={!canSubmit || submitting}>
            {submitting ? "Logging…" : "Log workout"}
          </Button>
        </form>
      </Card>

      <Card>
        {workouts === undefined ? (
          <p className="text-sm text-neutral-400">Loading…</p>
        ) : workouts.length === 0 ? (
          <p className="text-sm text-neutral-400">No workouts yet.</p>
        ) : (
          <ul className="divide-y divide-neutral-100 text-sm dark:divide-neutral-800">
            {workouts.map((w) => (
              <li
                key={w._id}
                className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium">
                    {w.items.map((it) => it.name).join(" + ") || "Workout"}
                  </div>
                  <div className="text-xs text-neutral-500">
                    {formatDate(w.performedAt)}
                    {w.durationMinutes != null &&
                      ` · ${w.durationMinutes} min`}
                  </div>
                  <ul className="mt-1 space-y-0.5 text-xs text-neutral-500">
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
                </div>
                <button
                  onClick={() => removeWorkout({ id: w._id })}
                  className={dangerButtonClass}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ExerciseDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialName={dialogInitialName}
        onCreated={onExerciseCreated}
      />
    </div>
  );
}
