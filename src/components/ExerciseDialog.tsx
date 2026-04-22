"use client";

import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Doc, Id } from "../../convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type Exercise = Doc<"exercises">;

export function ExerciseDialog({
  open,
  onOpenChange,
  exercise,
  initialName,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exercise?: Exercise;
  initialName?: string;
  onCreated?: (id: Id<"exercises">) => void;
}) {
  const addEx = useMutation(api.exercises.add);
  const updateEx = useMutation(api.exercises.update);

  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (exercise) {
      setName(exercise.name);
      setCategory(exercise.category ?? "");
    } else {
      setName(initialName ?? "");
      setCategory("");
    }
  }, [open, exercise, initialName]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        category: category.trim() || undefined,
      };
      if (exercise) {
        await updateEx({ id: exercise._id, ...payload });
      } else {
        const id = await addEx(payload);
        onCreated?.(id);
      }
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{exercise ? "Edit exercise" : "New exercise"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="ex-name">Name</Label>
            <Input
              id="ex-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Leg raises"
              required
              autoFocus
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ex-category">Category (optional)</Label>
            <Input
              id="ex-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="core, legs, push…"
              list="ex-category-suggestions"
            />
            <datalist id="ex-category-suggestions">
              <option value="core" />
              <option value="legs" />
              <option value="push" />
              <option value="pull" />
              <option value="cardio" />
            </datalist>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : exercise ? "Save" : "Create exercise"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
