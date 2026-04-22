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

export default function MealsPage() {
  const meals = useQuery(api.meals.list);
  const addMeal = useMutation(api.meals.add);
  const removeMeal = useMutation(api.meals.remove);

  // Most recent entry per unique meal name → used as templates for the dropdown.
  const templates = useMemo(() => {
    if (!meals) return [];
    const seen = new Map<string, (typeof meals)[number]>();
    for (const m of meals) if (!seen.has(m.name)) seen.set(m.name, m);
    return Array.from(seen.values());
  }, [meals]);

  const [selected, setSelected] = useState<string>("");
  const [name, setName] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Default the dropdown to the most recent template whenever the list loads.
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
    setCalories("");
    setProtein("");
    setCarbs("");
    setFat("");
    setNotes("");
  }

  function applyTemplate(templateName: string) {
    const t = templates.find((x) => x.name === templateName);
    if (!t) return;
    setSelected(templateName);
    setName(t.name);
    setCalories(t.calories != null ? String(t.calories) : "");
    setProtein(t.protein != null ? String(t.protein) : "");
    setCarbs(t.carbs != null ? String(t.carbs) : "");
    setFat(t.fat != null ? String(t.fat) : "");
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
      await addMeal({
        name: name.trim(),
        calories: calories ? Number(calories) : undefined,
        protein: protein ? Number(protein) : undefined,
        carbs: carbs ? Number(carbs) : undefined,
        fat: fat ? Number(fat) : undefined,
        notes: notes.trim() || undefined,
      });
      // After logging, re-select the just-added entry as the current template.
      if (isNew) setSelected(name.trim());
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader title="Meals" description="Log what you ate." />

      <Card className="mb-6">
        <form onSubmit={onSubmit} className="grid grid-cols-2 gap-3 sm:grid-cols-6">
          <select
            className={`${inputClass} col-span-2 sm:col-span-6`}
            value={selected}
            onChange={(e) => onPickChange(e.target.value)}
          >
            {templates.length === 0 && (
              <option value="" disabled>
                No previous meals — add a new one below
              </option>
            )}
            {templates.map((t) => (
              <option key={t._id} value={t.name}>
                {t.name}
                {t.calories != null ? ` · ${t.calories} kcal` : ""}
              </option>
            ))}
            <option value={NEW_VALUE}>+ Add a new meal…</option>
          </select>

          {isNew && (
            <input
              className={`${inputClass} col-span-2 sm:col-span-6`}
              placeholder="New meal name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          )}

          <input
            className={inputClass}
            placeholder="kcal"
            type="number"
            inputMode="numeric"
            min="0"
            value={calories}
            onChange={(e) => setCalories(e.target.value)}
          />
          <input
            className={inputClass}
            placeholder="Protein (g)"
            type="number"
            inputMode="decimal"
            min="0"
            value={protein}
            onChange={(e) => setProtein(e.target.value)}
          />
          <input
            className={inputClass}
            placeholder="Carbs (g)"
            type="number"
            inputMode="decimal"
            min="0"
            value={carbs}
            onChange={(e) => setCarbs(e.target.value)}
          />
          <input
            className={inputClass}
            placeholder="Fat (g)"
            type="number"
            inputMode="decimal"
            min="0"
            value={fat}
            onChange={(e) => setFat(e.target.value)}
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
                ? "Add meal"
                : pickedTemplate
                  ? `Log ${pickedTemplate.name}`
                  : "Log meal"}
          </button>
        </form>
      </Card>

      <Card>
        {meals === undefined ? (
          <p className="text-sm text-neutral-400">Loading…</p>
        ) : meals.length === 0 ? (
          <p className="text-sm text-neutral-400">No meals yet.</p>
        ) : (
          <ul className="divide-y divide-neutral-100 text-sm dark:divide-neutral-800">
            {meals.map((m) => (
              <li
                key={m._id}
                className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="font-medium">{m.name}</div>
                  <div className="text-xs text-neutral-500">
                    {formatDate(m.consumedAt)}
                    {m.calories != null && ` · ${m.calories} kcal`}
                    {m.protein != null && ` · P ${m.protein}g`}
                    {m.carbs != null && ` · C ${m.carbs}g`}
                    {m.fat != null && ` · F ${m.fat}g`}
                  </div>
                  {m.notes && (
                    <div className="text-xs text-neutral-500">{m.notes}</div>
                  )}
                </div>
                <button
                  onClick={() => removeMeal({ id: m._id })}
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
