"use client";

import { useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../../../../convex/_generated/api";
import {
  Card,
  PageHeader,
  dangerButtonClass,
  formatDate,
  inputClass,
  primaryButtonClass,
} from "@/components/ui";

const NEW_VALUE = "__new__";

export default function WorkoutsPage() {
  const workouts = useQuery(api.workouts.list);
  const addWorkout = useMutation(api.workouts.add);
  const removeWorkout = useMutation(api.workouts.remove);

  const templates = useMemo(() => {
    if (!workouts) return [];
    const seen = new Map<string, (typeof workouts)[number]>();
    for (const w of workouts) if (!seen.has(w.name)) seen.set(w.name, w);
    return Array.from(seen.values());
  }, [workouts]);

  const [selected, setSelected] = useState<string>("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [duration, setDuration] = useState("");
  const [calories, setCalories] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (selected === "" && templates.length > 0) {
      applyTemplate(templates[0].name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templates.length]);

  const isNew = selected === NEW_VALUE;
  const pickedTemplate = templates.find((t) => t.name === selected);

  function clearFields() {
    setName("");
    setCategory("");
    setDuration("");
    setCalories("");
    setNotes("");
  }

  function applyTemplate(templateName: string) {
    const t = templates.find((x) => x.name === templateName);
    if (!t) return;
    setSelected(templateName);
    setName(t.name);
    setCategory(t.category ?? "");
    setDuration(t.durationMinutes != null ? String(t.durationMinutes) : "");
    setCalories(t.caloriesBurned != null ? String(t.caloriesBurned) : "");
    setNotes(t.notes ?? "");
  }

  function onPickChange(value: string) {
    if (value === NEW_VALUE) {
      setSelected(NEW_VALUE);
      clearFields();
      return;
    }
    applyTemplate(value);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await addWorkout({
        name: name.trim(),
        category: category.trim() || undefined,
        durationMinutes: duration ? Number(duration) : undefined,
        caloriesBurned: calories ? Number(calories) : undefined,
        notes: notes.trim() || undefined,
      });
      if (isNew) setSelected(name.trim());
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader title="Workouts" description="Log training sessions." />

      <Card className="mb-6">
        <form
          onSubmit={onSubmit}
          className="grid grid-cols-2 gap-3 sm:grid-cols-6"
        >
          <select
            className={`${inputClass} col-span-2 sm:col-span-6`}
            value={selected}
            onChange={(e) => onPickChange(e.target.value)}
          >
            {templates.length === 0 && (
              <option value="" disabled>
                No previous workouts — add a new one below
              </option>
            )}
            {templates.map((t) => (
              <option key={t._id} value={t.name}>
                {t.name}
                {t.category ? ` · ${t.category}` : ""}
                {t.durationMinutes != null ? ` · ${t.durationMinutes}min` : ""}
              </option>
            ))}
            <option value={NEW_VALUE}>+ Add a new workout…</option>
          </select>

          {isNew && (
            <input
              className={`${inputClass} col-span-2 sm:col-span-6`}
              placeholder="New workout name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          )}

          <input
            className={`${inputClass} col-span-2 sm:col-span-2`}
            placeholder="Category (e.g. run)"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
          <input
            className={inputClass}
            placeholder="Minutes"
            type="number"
            inputMode="numeric"
            min="0"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
          />
          <input
            className={inputClass}
            placeholder="Calories"
            type="number"
            inputMode="numeric"
            min="0"
            value={calories}
            onChange={(e) => setCalories(e.target.value)}
          />
          <input
            className={`${inputClass} col-span-2 sm:col-span-4`}
            placeholder="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <button
            type="submit"
            disabled={submitting || (!isNew && !pickedTemplate)}
            className={`${primaryButtonClass} col-span-2 sm:col-span-2`}
          >
            {submitting
              ? "Logging…"
              : isNew
                ? "Add workout"
                : pickedTemplate
                  ? `Log ${pickedTemplate.name}`
                  : "Log workout"}
          </button>
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
                className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="font-medium">
                    {w.name}
                    {w.category && (
                      <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                        {w.category}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-neutral-500">
                    {formatDate(w.performedAt)}
                    {w.durationMinutes != null &&
                      ` · ${w.durationMinutes} min`}
                    {w.caloriesBurned != null &&
                      ` · ${w.caloriesBurned} kcal`}
                  </div>
                  {w.notes && (
                    <div className="text-xs text-neutral-500">{w.notes}</div>
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
    </div>
  );
}
