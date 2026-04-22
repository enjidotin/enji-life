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
import { FoodCombobox } from "@/components/FoodCombobox";
import { FoodDialog } from "@/components/FoodDialog";
import { mealTotals, roundTotal, formatQty } from "@/lib/meals";
import { Plus, X } from "lucide-react";
import Link from "next/link";

type Row = { foodId: Id<"foods"> | null; quantity: string };

const emptyRow: Row = { foodId: null, quantity: "1" };

export default function MealsPage() {
  const meals = useQuery(api.meals.list);
  const foods = useQuery(api.foods.list);
  const addMeal = useMutation(api.meals.add);
  const removeMeal = useMutation(api.meals.remove);

  const [rows, setRows] = useState<Row[]>([{ ...emptyRow }]);
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

  function openCreateFood(rowIdx: number, initialName: string) {
    setTargetRowIdx(rowIdx);
    setDialogInitialName(initialName);
    setDialogOpen(true);
  }

  function onFoodCreated(id: Id<"foods">) {
    if (targetRowIdx != null) {
      updateRow(targetRowIdx, { foodId: id });
      setTargetRowIdx(null);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const items = rows
      .filter((r) => r.foodId && Number(r.quantity) > 0)
      .map((r) => ({
        foodId: r.foodId as Id<"foods">,
        quantity: Number(r.quantity),
      }));
    if (items.length === 0) return;
    setSubmitting(true);
    try {
      await addMeal({ items, notes: notes.trim() || undefined });
      setRows([{ ...emptyRow }]);
      setNotes("");
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = rows.some(
    (r) => r.foodId && Number(r.quantity) > 0,
  );

  return (
    <div>
      <div className="mb-5 flex items-start justify-between gap-3 sm:mb-6">
        <PageHeader
          title="Meals"
          description="Log what you ate. Pick foods from your library; macros are computed from quantity."
        />
        <Link
          href="/foods"
          className="mt-1 shrink-0 text-sm text-neutral-500 underline-offset-4 hover:underline"
        >
          Manage foods →
        </Link>
      </div>

      <Card className="mb-6">
        <form onSubmit={onSubmit} className="grid gap-3">
          {rows.map((row, idx) => (
            <div
              key={idx}
              className="grid grid-cols-[1fr_auto] items-center gap-2 sm:grid-cols-[1fr_120px_auto]"
            >
              <div className="min-w-0">
                <FoodCombobox
                  foods={foods ?? []}
                  value={row.foodId}
                  onSelect={(id) => updateRow(idx, { foodId: id })}
                  onCreateNew={(name) => openCreateFood(idx, name)}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeRow(idx)}
                aria-label="Remove row"
                className="sm:order-last"
              >
                <X className="size-4" />
              </Button>
              <input
                className={`${inputClass} col-span-2 sm:col-span-1`}
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                placeholder="Quantity"
                value={row.quantity}
                onChange={(e) =>
                  updateRow(idx, { quantity: e.target.value })
                }
              />
            </div>
          ))}

          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addRow}
            >
              <Plus className="mr-1 size-4" />
              Add food
            </Button>
          </div>

          <input
            className={inputClass}
            placeholder="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          <Button type="submit" disabled={!canSubmit || submitting}>
            {submitting ? "Logging…" : "Log meal"}
          </Button>
        </form>
      </Card>

      <Card>
        {meals === undefined ? (
          <p className="text-sm text-neutral-400">Loading…</p>
        ) : meals.length === 0 ? (
          <p className="text-sm text-neutral-400">No meals yet.</p>
        ) : (
          <ul className="divide-y divide-neutral-100 text-sm dark:divide-neutral-800">
            {meals.map((m) => {
              const totals = mealTotals(m.items);
              return (
                <li
                  key={m._id}
                  className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">
                      {m.items.map((it) => it.name).join(" + ") || "Meal"}
                    </div>
                    <div className="text-xs text-neutral-500">
                      {formatDate(m.consumedAt)}
                      {totals.calories > 0 &&
                        ` · ${roundTotal(totals.calories)} kcal`}
                      {totals.protein > 0 &&
                        ` · P ${roundTotal(totals.protein)}g`}
                      {totals.carbs > 0 &&
                        ` · C ${roundTotal(totals.carbs)}g`}
                      {totals.fat > 0 && ` · F ${roundTotal(totals.fat)}g`}
                    </div>
                    <div className="mt-1 text-xs text-neutral-500">
                      {m.items
                        .map((it) => `${formatQty(it.quantity, it.unit)} ${it.name}`)
                        .join(", ")}
                    </div>
                    {m.notes && (
                      <div className="mt-1 text-xs text-neutral-500">{m.notes}</div>
                    )}
                  </div>
                  <button
                    onClick={() => removeMeal({ id: m._id })}
                    className={dangerButtonClass}
                  >
                    Delete
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <FoodDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialName={dialogInitialName}
        onCreated={onFoodCreated}
      />
    </div>
  );
}
