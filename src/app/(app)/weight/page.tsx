"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { ChevronDown } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { Doc } from "../../../../convex/_generated/dataModel";
import {
  Card,
  PageHeader,
  dangerButtonClass,
  formatDate,
  inputClass,
  primaryButtonClass,
  timeAgo,
} from "@/components/ui";
import { DataTable } from "@/components/ui/data-table";
import { cn } from "@/lib/utils";

type WeightLog = Doc<"weightLogs">;

export default function WeightPage() {
  const logs = useQuery(api.weight.list);
  const addLog = useMutation(api.weight.add);
  const removeLog = useMutation(api.weight.remove);

  const [weight, setWeight] = useState("");
  const [unit, setUnit] = useState<"kg" | "lb">("kg");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!weight) return;
    setSubmitting(true);
    try {
      await addLog({
        weight: Number(weight),
        unit,
        notes: notes.trim() || undefined,
      });
      setWeight("");
      setNotes("");
    } finally {
      setSubmitting(false);
    }
  }

  const values = logs?.map((l) => l.weight) ?? [];
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 0;

  const columns: ColumnDef<WeightLog, unknown>[] = [
    {
      id: "weight",
      header: "Weight",
      cell: ({ row }) => (
        <span className="font-medium">
          {row.original.weight} {row.original.unit}
        </span>
      ),
    },
    {
      id: "when",
      header: "When",
      cell: ({ row }) => (
        <span className="text-neutral-500">{timeAgo(row.original.loggedAt)}</span>
      ),
      meta: { headClassName: "text-right", cellClassName: "text-right" },
    },
    {
      id: "expander",
      header: () => null,
      cell: ({ row }) => (
        <ChevronDown
          className={cn(
            "ml-auto size-4 text-neutral-400 transition-transform",
            row.getIsExpanded() && "rotate-180",
          )}
        />
      ),
      meta: { headClassName: "w-8", cellClassName: "w-8" },
    },
  ];

  return (
    <div>
      <PageHeader title="Weight" description="Track your weight over time." />

      <Card className="mb-6">
        <form
          onSubmit={onSubmit}
          className="grid grid-cols-3 gap-3 sm:grid-cols-6"
        >
          <input
            className={`${inputClass} col-span-2 sm:col-span-2`}
            placeholder="Weight"
            type="number"
            inputMode="decimal"
            step="0.1"
            min="0"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            required
          />
          <select
            className={inputClass}
            value={unit}
            onChange={(e) => setUnit(e.target.value as "kg" | "lb")}
          >
            <option value="kg">kg</option>
            <option value="lb">lb</option>
          </select>
          <input
            className={`${inputClass} col-span-3 sm:col-span-2`}
            placeholder="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <button
            type="submit"
            disabled={submitting}
            className={`${primaryButtonClass} col-span-3 sm:col-span-1`}
          >
            {submitting ? "Saving…" : "Log weight"}
          </button>
        </form>
      </Card>

      {logs && logs.length > 0 && (
        <div className="mb-6 grid grid-cols-3 gap-2 sm:gap-4">
          <Card>
            <div className="text-sm text-neutral-500">Latest</div>
            <div className="mt-1 text-2xl font-semibold">
              {logs[0].weight} {logs[0].unit}
            </div>
          </Card>
          <Card>
            <div className="text-sm text-neutral-500">Lowest</div>
            <div className="mt-1 text-2xl font-semibold">{min}</div>
          </Card>
          <Card>
            <div className="text-sm text-neutral-500">Highest</div>
            <div className="mt-1 text-2xl font-semibold">{max}</div>
          </Card>
        </div>
      )}

      <Card>
        {logs === undefined ? (
          <p className="text-sm text-neutral-400">Loading…</p>
        ) : (
          <DataTable<WeightLog>
            columns={columns}
            data={logs}
            emptyText="No weight logs yet."
            renderSubRow={(row) => {
              const l = row.original;
              const older = logs[row.index + 1];
              const delta = older
                ? Math.round((l.weight - older.weight) * 10) / 10
                : null;
              return (
                <div className="px-4 py-3 text-sm">
                  <div className="text-neutral-500">{formatDate(l.loggedAt)}</div>
                  {delta !== null && delta !== 0 && (
                    <div className="mt-1 text-xs text-neutral-500">
                      {delta > 0 ? `▲ +${delta}` : `▼ ${delta}`} {l.unit} vs previous
                    </div>
                  )}
                  {l.notes && (
                    <div className="mt-1 text-neutral-600 dark:text-neutral-300">
                      {l.notes}
                    </div>
                  )}
                  <button
                    onClick={() => removeLog({ id: l._id })}
                    className={`${dangerButtonClass} mt-2`}
                  >
                    Delete
                  </button>
                </div>
              );
            }}
          />
        )}
      </Card>
    </div>
  );
}
