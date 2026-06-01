"use client";

import { Minus, Plus } from "lucide-react";

// Tap-first quantity control. Big -/+ targets for thumbs; the number stays
// tappable so a value can still be typed when needed.
export function QuantityStepper({
  value,
  onChange,
  step = 1,
  min = 0,
}: {
  value: number;
  onChange: (next: number) => void;
  step?: number;
  min?: number;
}) {
  const round = (n: number) => Math.round(n * 100) / 100;
  const dec = () => onChange(Math.max(min, round(value - step)));
  const inc = () => onChange(round(value + step));

  return (
    <div className="inline-flex items-center rounded-md border border-neutral-300 dark:border-neutral-700">
      <button
        type="button"
        onClick={dec}
        aria-label="Decrease quantity"
        className="flex size-9 items-center justify-center text-neutral-500 hover:text-neutral-900 active:bg-neutral-100 disabled:opacity-40 dark:hover:text-neutral-100 dark:active:bg-neutral-800"
        disabled={value <= min}
      >
        <Minus className="size-4" />
      </button>
      <input
        type="number"
        inputMode="decimal"
        min={min}
        step="any"
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          onChange(Number.isFinite(n) ? Math.max(min, n) : min);
        }}
        className="w-12 border-x border-neutral-300 bg-transparent py-2 text-center text-sm tabular-nums focus:outline-none dark:border-neutral-700 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <button
        type="button"
        onClick={inc}
        aria-label="Increase quantity"
        className="flex size-9 items-center justify-center text-neutral-500 hover:text-neutral-900 active:bg-neutral-100 dark:hover:text-neutral-100 dark:active:bg-neutral-800"
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}
