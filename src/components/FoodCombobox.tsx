"use client";

import { Doc, Id } from "../../convex/_generated/dataModel";
import { SearchableCombobox } from "./SearchableCombobox";

type Food = Doc<"foods">;

export function FoodCombobox({
  foods,
  value,
  onSelect,
  onCreateNew,
}: {
  foods: Food[];
  value: Id<"foods"> | null;
  onSelect: (id: Id<"foods">) => void;
  onCreateNew: (search: string) => void;
}) {
  return (
    <SearchableCombobox<Id<"foods">>
      items={foods.map((f) => ({
        id: f._id,
        label: f.name,
        sublabel: `per ${f.unit}${f.calories != null ? ` · ${f.calories} kcal` : ""}`,
        searchValue: `${f.name} ${f.unit}`,
      }))}
      value={value}
      onSelect={onSelect}
      onCreateNew={onCreateNew}
      placeholder="Select food…"
      emptyText="No matching food."
      createLabel="Add a new food…"
    />
  );
}
