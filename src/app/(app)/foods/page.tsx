"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Doc } from "../../../../convex/_generated/dataModel";
import { Card, PageHeader } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { FoodDialog } from "@/components/FoodDialog";
import { Pencil, Trash2, Plus } from "lucide-react";

type Food = Doc<"foods">;

export default function FoodsPage() {
  const foods = useQuery(api.foods.list);
  const removeFood = useMutation(api.foods.remove);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Food | undefined>();

  function openNew() {
    setEditing(undefined);
    setDialogOpen(true);
  }
  function openEdit(food: Food) {
    setEditing(food);
    setDialogOpen(true);
  }

  const sorted = foods
    ? [...foods].sort((a, b) => a.name.localeCompare(b.name))
    : [];

  return (
    <div>
      <PageHeader
        title="Foods"
        description="Your reusable food library. Macros are saved per unit and reused when logging meals."
      />

      <div className="mb-4 flex justify-end">
        <Button onClick={openNew}>
          <Plus className="mr-1 size-4" />
          New food
        </Button>
      </div>

      <Card>
        {foods === undefined ? (
          <p className="text-sm text-neutral-400">Loading…</p>
        ) : sorted.length === 0 ? (
          <p className="text-sm text-neutral-400">
            No foods yet. Add one to start logging meals.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-100 text-sm dark:divide-neutral-800">
            {sorted.map((f) => (
              <li
                key={f._id}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium">
                    {f.name}{" "}
                    <span className="text-xs font-normal text-neutral-500">
                      per {f.unit}
                    </span>
                  </div>
                  <div className="text-xs text-neutral-500">
                    {f.calories != null ? `${f.calories} kcal` : "— kcal"}
                    {f.protein != null && ` · P ${f.protein}g`}
                    {f.carbs != null && ` · C ${f.carbs}g`}
                    {f.fat != null && ` · F ${f.fat}g`}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => openEdit(f)}
                    aria-label={`Edit ${f.name}`}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => removeFood({ id: f._id })}
                    aria-label={`Delete ${f.name}`}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <FoodDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        food={editing}
      />
    </div>
  );
}
