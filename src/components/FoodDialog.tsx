"use client";

import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Doc, Id } from "../../convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type Food = Doc<"foods">;

export function FoodDialog({
  open,
  onOpenChange,
  food,
  initialName,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  food?: Food;
  initialName?: string;
  onCreated?: (id: Id<"foods">) => void;
}) {
  const addFood = useMutation(api.foods.add);
  const updateFood = useMutation(api.foods.update);

  const [name, setName] = useState("");
  const [unit, setUnit] = useState("serving");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (food) {
      setName(food.name);
      setUnit(food.unit);
      setCalories(food.calories != null ? String(food.calories) : "");
      setProtein(food.protein != null ? String(food.protein) : "");
      setCarbs(food.carbs != null ? String(food.carbs) : "");
      setFat(food.fat != null ? String(food.fat) : "");
    } else {
      setName(initialName ?? "");
      setUnit("serving");
      setCalories("");
      setProtein("");
      setCarbs("");
      setFat("");
    }
  }, [open, food, initialName]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !unit.trim()) return;
    setSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        unit: unit.trim(),
        calories: calories ? Number(calories) : undefined,
        protein: protein ? Number(protein) : undefined,
        carbs: carbs ? Number(carbs) : undefined,
        fat: fat ? Number(fat) : undefined,
      };
      if (food) {
        await updateFood({ id: food._id, ...payload });
      } else {
        const id = await addFood(payload);
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
          <DialogTitle>{food ? "Edit food" : "New food"}</DialogTitle>
          <DialogDescription>
            Macros are per one unit (one cup, one egg, one serving, etc).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="food-name">Name</Label>
            <Input
              id="food-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Dal"
              required
              autoFocus
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="food-unit">Unit</Label>
            <Input
              id="food-unit"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="cup, egg, serving, g…"
              list="unit-suggestions"
              required
            />
            <datalist id="unit-suggestions">
              <option value="serving" />
              <option value="cup" />
              <option value="egg" />
              <option value="slice" />
              <option value="piece" />
              <option value="tbsp" />
              <option value="tsp" />
              <option value="g" />
              <option value="oz" />
              <option value="ml" />
            </datalist>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="grid gap-1.5">
              <Label htmlFor="food-kcal">kcal</Label>
              <Input
                id="food-kcal"
                type="number"
                inputMode="decimal"
                min="0"
                value={calories}
                onChange={(e) => setCalories(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="food-p">Protein (g)</Label>
              <Input
                id="food-p"
                type="number"
                inputMode="decimal"
                min="0"
                value={protein}
                onChange={(e) => setProtein(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="food-c">Carbs (g)</Label>
              <Input
                id="food-c"
                type="number"
                inputMode="decimal"
                min="0"
                value={carbs}
                onChange={(e) => setCarbs(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="food-f">Fat (g)</Label>
              <Input
                id="food-f"
                type="number"
                inputMode="decimal"
                min="0"
                value={fat}
                onChange={(e) => setFat(e.target.value)}
              />
            </div>
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
              {submitting ? "Saving…" : food ? "Save" : "Create food"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
