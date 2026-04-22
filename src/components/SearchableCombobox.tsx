"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type ComboboxItem<Id extends string> = {
  id: Id;
  label: string;
  sublabel?: string;
  searchValue: string;
};

export function SearchableCombobox<Id extends string>({
  items,
  value,
  onSelect,
  onCreateNew,
  placeholder = "Select…",
  emptyText = "No matches.",
  createLabel = "Add new…",
  buttonText,
}: {
  items: ComboboxItem<Id>[];
  value: Id | null;
  onSelect: (id: Id) => void;
  onCreateNew: (search: string) => void;
  placeholder?: string;
  emptyText?: string;
  createLabel?: string;
  buttonText?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = items.find((f) => f.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        type="button"
        role="combobox"
        aria-expanded={open}
        className={cn(
          buttonVariants({ variant: "outline" }),
          "h-9 w-full justify-between px-3 font-normal",
        )}
      >
        <span
          className={cn(
            "truncate text-left",
            !selected && "text-muted-foreground",
          )}
        >
          {buttonText ??
            (selected
              ? selected.sublabel
                ? `${selected.label} · ${selected.sublabel}`
                : selected.label
              : placeholder)}
        </span>
        <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent
        className="w-[max(var(--anchor-width),16rem)] max-w-[calc(100vw-1rem)] p-0"
        align="start"
      >
        <Command>
          <CommandInput
            placeholder="Search…"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty className="py-3 text-center text-sm text-neutral-500">
              {emptyText}
            </CommandEmpty>
            {items.length > 0 && (
              <CommandGroup>
                {items.map((it) => (
                  <CommandItem
                    key={it.id}
                    value={it.searchValue}
                    onSelect={() => {
                      onSelect(it.id);
                      setSearch("");
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 size-4 shrink-0",
                        value === it.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate">{it.label}</span>
                      {it.sublabel && (
                        <span className="truncate text-xs text-neutral-500">
                          {it.sublabel}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            <CommandSeparator />
            <CommandGroup>
              <CommandItem
                onSelect={() => {
                  onCreateNew(search);
                  setSearch("");
                  setOpen(false);
                }}
              >
                <Plus className="mr-2 size-4" />
                {search.trim()
                  ? `Create “${search.trim()}”…`
                  : createLabel}
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
