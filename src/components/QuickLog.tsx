"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { useRef, useState } from "react";
import { api } from "../../convex/_generated/api";
import type { ParsedLog } from "../../convex/ai";
import { VoiceButton } from "@/components/VoiceButton";
import { Card, formatDate, inputClass, pillClass } from "@/components/ui";
import { roundTotal, formatQty } from "@/lib/meals";
import { Check, Dumbbell, Scale, Sparkles, Utensils, X } from "lucide-react";

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type Review = Exclude<ParsedLog, { kind: "none" }>;

const kindMeta = {
  meal: { label: "Meal", icon: Utensils },
  workout: { label: "Workout", icon: Dumbbell },
  weight: { label: "Weight", icon: Scale },
} as const;

// One voice (or text) entry that figures out what you're logging — meal,
// workout, or weigh-in — shows what it understood, and saves on confirm.
export function QuickLog() {
  const parseLog = useAction(api.ai.parseLog);
  const logMeal = useMutation(api.meals.logItems);
  const logWorkout = useMutation(api.workouts.logItems);
  const addWeight = useMutation(api.weight.add);
  const weights = useQuery(api.weight.list);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<keyof typeof kindMeta | null>(null);
  const [showText, setShowText] = useState(false);
  const [text, setText] = useState("");
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function runParse(input: {
    text?: string;
    audio?: { data: string; format: string };
  }) {
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      const parsed = await parseLog({ ...input, nowLocal: toLocalInput(new Date()) });
      if (parsed.kind === "none") {
        setError(
          "Couldn't tell what that was. Try something like “2 eggs and toast”, “bench pressed 80 kilos”, or “I'm at 82.4 today”.",
        );
        return;
      }
      setReview(parsed);
      setText("");
      setShowText(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function onConfirm() {
    if (!review) return;
    setSaving(true);
    setError(null);
    try {
      if (review.kind === "meal") {
        await logMeal({
          items: review.items,
          consumedAt: review.consumedAt
            ? new Date(review.consumedAt).getTime()
            : undefined,
        });
      } else if (review.kind === "workout") {
        await logWorkout({
          items: review.items,
          durationMinutes: review.durationMinutes,
          performedAt: review.performedAt
            ? new Date(review.performedAt).getTime()
            : undefined,
        });
      } else {
        await addWeight({
          weight: review.weight,
          unit: review.unit ?? weights?.[0]?.unit ?? "kg",
          loggedAt: review.loggedAt ? new Date(review.loggedAt).getTime() : undefined,
        });
      }
      setSaved(review.kind);
      setReview(null);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaved(null), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that.");
    } finally {
      setSaving(false);
    }
  }

  const when =
    review?.kind === "meal"
      ? review.consumedAt
      : review?.kind === "workout"
        ? review.performedAt
        : review?.kind === "weight"
          ? review.loggedAt
          : undefined;

  return (
    <Card className="min-w-0">
      <div className="grid gap-3">
        <VoiceButton
          size="lg"
          idleLabel="Tap & say what you ate, trained, or weigh"
          onResult={(audio) => void runParse({ audio: { data: audio, format: "wav" } })}
          onError={setError}
          disabled={busy || saving || review !== null}
        />

        {showText ? (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (text.trim()) void runParse({ text: text.trim() });
            }}
          >
            <input
              className={`${inputClass} min-w-0 flex-1`}
              placeholder="e.g. 2 eggs and toast / bench day / 82.4 kg"
              value={text}
              onChange={(e) => setText(e.target.value)}
              autoFocus
            />
            <button
              type="submit"
              disabled={!text.trim() || busy}
              className="flex shrink-0 items-center gap-1.5 rounded-md border border-neutral-300 px-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
            >
              <Sparkles className="size-4" />
              {busy ? "Reading…" : "Go"}
            </button>
          </form>
        ) : (
          !review && (
            <button
              type="button"
              onClick={() => setShowText(true)}
              className="text-center text-xs text-neutral-500 underline-offset-4 hover:underline"
            >
              or type it instead
            </button>
          )
        )}

        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

        {saved && (
          <p className="flex items-center justify-center gap-1.5 text-sm font-medium text-green-600 dark:text-green-400">
            <Check className="size-4" />
            {kindMeta[saved].label} logged
          </p>
        )}

        {review && (
          <div className="min-w-0 rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
            <div className="flex items-center gap-2">
              {(() => {
                const Icon = kindMeta[review.kind].icon;
                return <Icon className="size-4 shrink-0 text-neutral-500" />;
              })()}
              <span className="text-sm font-semibold">
                {kindMeta[review.kind].label}
              </span>
              {review.kind === "meal" && (
                <span className={pillClass}>
                  ≈{" "}
                  {roundTotal(
                    review.items.reduce((s, it) => s + it.calories * it.quantity, 0),
                  )}{" "}
                  kcal
                </span>
              )}
              {review.kind === "workout" && review.durationMinutes != null && (
                <span className={pillClass}>{review.durationMinutes} min</span>
              )}
              {when && (
                <span className={pillClass}>
                  {formatDate(new Date(when).getTime())}
                </span>
              )}
            </div>

            {review.kind === "meal" && (
              <ul className="mt-2 space-y-0.5 text-sm text-neutral-600 dark:text-neutral-300">
                {review.items.map((it, i) => (
                  <li key={i} className="truncate">
                    {formatQty(it.quantity, it.unit)} {it.name}
                    {it.calories > 0 &&
                      ` · ${roundTotal(it.calories * it.quantity)} kcal`}
                  </li>
                ))}
              </ul>
            )}
            {review.kind === "workout" && (
              <ul className="mt-2 space-y-0.5 text-sm text-neutral-600 dark:text-neutral-300">
                {review.items.map((it, i) => (
                  <li key={i} className="truncate">
                    {it.name}
                    {it.maxWeight != null && ` · ${it.maxWeight}`}
                    {it.totalReps != null && ` × ${it.totalReps}`}
                  </li>
                ))}
              </ul>
            )}
            {review.kind === "weight" && (
              <p className="mt-2 text-2xl font-semibold">
                {review.weight} {review.unit ?? weights?.[0]?.unit ?? "kg"}
              </p>
            )}

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => void onConfirm()}
                disabled={saving}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-neutral-900 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
              >
                <Check className="size-4" />
                {saving ? "Logging…" : `Log ${kindMeta[review.kind].label.toLowerCase()}`}
              </button>
              <button
                type="button"
                onClick={() => setReview(null)}
                disabled={saving}
                className="flex items-center justify-center gap-1.5 rounded-md border border-neutral-200 px-4 py-2.5 text-sm text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
                <X className="size-4" />
                Discard
              </button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
