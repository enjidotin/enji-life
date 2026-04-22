"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Doc } from "../../../../convex/_generated/dataModel";
import { Card, PageHeader } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { ExerciseDialog } from "@/components/ExerciseDialog";
import { Pencil, Trash2, Plus } from "lucide-react";

type Exercise = Doc<"exercises">;

export default function ExercisesPage() {
  const exercises = useQuery(api.exercises.list);
  const removeEx = useMutation(api.exercises.remove);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Exercise | undefined>();

  function openNew() {
    setEditing(undefined);
    setDialogOpen(true);
  }
  function openEdit(ex: Exercise) {
    setEditing(ex);
    setDialogOpen(true);
  }

  const sorted = exercises
    ? [...exercises].sort((a, b) => a.name.localeCompare(b.name))
    : [];

  return (
    <div>
      <PageHeader
        title="Exercises"
        description="Your reusable exercise library. Used when logging workouts."
      />

      <div className="mb-4 flex justify-end">
        <Button onClick={openNew}>
          <Plus className="mr-1 size-4" />
          New exercise
        </Button>
      </div>

      <Card>
        {exercises === undefined ? (
          <p className="text-sm text-neutral-400">Loading…</p>
        ) : sorted.length === 0 ? (
          <p className="text-sm text-neutral-400">
            No exercises yet. Add one to start logging workouts.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-100 text-sm dark:divide-neutral-800">
            {sorted.map((e) => (
              <li
                key={e._id}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium">
                    {e.name}
                    {e.category && (
                      <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                        {e.category}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => openEdit(e)}
                    aria-label={`Edit ${e.name}`}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => removeEx({ id: e._id })}
                    aria-label={`Delete ${e.name}`}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ExerciseDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        exercise={editing}
      />
    </div>
  );
}
