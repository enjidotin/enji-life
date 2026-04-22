"use client";

import { Doc, Id } from "../../convex/_generated/dataModel";
import { SearchableCombobox } from "./SearchableCombobox";

type Exercise = Doc<"exercises">;

export function ExerciseCombobox({
  exercises,
  value,
  onSelect,
  onCreateNew,
}: {
  exercises: Exercise[];
  value: Id<"exercises"> | null;
  onSelect: (id: Id<"exercises">) => void;
  onCreateNew: (search: string) => void;
}) {
  return (
    <SearchableCombobox<Id<"exercises">>
      items={exercises.map((e) => ({
        id: e._id,
        label: e.name,
        sublabel: e.category,
        searchValue: `${e.name} ${e.category ?? ""}`,
      }))}
      value={value}
      onSelect={onSelect}
      onCreateNew={onCreateNew}
      placeholder="Select exercise…"
      emptyText="No matching exercise."
      createLabel="Add a new exercise…"
    />
  );
}
