import { Doc } from "../../convex/_generated/dataModel";

export type MealItem = Doc<"meals">["items"][number];

export function mealTotals(items: MealItem[]) {
  return items.reduce(
    (acc, it) => {
      acc.calories += (it.calories ?? 0) * it.quantity;
      acc.protein += (it.protein ?? 0) * it.quantity;
      acc.carbs += (it.carbs ?? 0) * it.quantity;
      acc.fat += (it.fat ?? 0) * it.quantity;
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

export function roundTotal(n: number) {
  return Math.round(n * 10) / 10;
}

export function formatQty(qty: number, unit: string) {
  const n = Number.isInteger(qty) ? qty : Math.round(qty * 100) / 100;
  const plural = qty === 1 ? unit : pluralize(unit);
  return `${n} ${plural}`;
}

function pluralize(unit: string) {
  const u = unit.toLowerCase();
  if (u.endsWith("s") || u === "g" || u === "oz" || u === "ml") return unit;
  return unit + "s";
}
