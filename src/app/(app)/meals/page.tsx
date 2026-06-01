"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { api } from "../../../../convex/_generated/api";
import { Doc, Id } from "../../../../convex/_generated/dataModel";
import {
  Card,
  PageHeader,
  dangerButtonClass,
  formatDate,
  inputClass,
} from "@/components/ui";
import { Button } from "@/components/ui/button";
import { SearchableCombobox } from "@/components/SearchableCombobox";
import { QuantityStepper } from "@/components/QuantityStepper";
import { VoiceButton } from "@/components/VoiceButton";
import { FoodDialog } from "@/components/FoodDialog";
import { mealTotals, roundTotal, formatQty } from "@/lib/meals";
import { Sparkles, X, RotateCcw, Clock, Plus } from "lucide-react";
import Link from "next/link";

const chipClass =
  "inline-flex items-center gap-1.5 rounded-full border border-neutral-200 px-3.5 py-2 text-sm text-neutral-600 hover:border-neutral-400 hover:bg-neutral-50 active:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:border-neutral-500 dark:hover:bg-neutral-800";

const pillClass =
  "rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300";

type Food = Doc<"foods">;
type MealItem = Doc<"meals">["items"][number];

type Draft = {
  key: number;
  foodId: Id<"foods"> | null;
  name: string;
  unit: string;
  quantity: number;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
};

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function MealsPage() {
  const meals = useQuery(api.meals.list);
  const foods = useQuery(api.foods.list);
  const parseMeal = useAction(api.ai.parseMeal);
  const logItems = useMutation(api.meals.logItems);
  const removeMeal = useMutation(api.meals.remove);

  const keyRef = useRef(0);
  const nextKey = () => ++keyRef.current;

  const [text, setText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Time: default "now". Optionally pick a past time.
  const [customTime, setCustomTime] = useState(false);
  const [whenValue, setWhenValue] = useState("");

  // Secondary controls stay tucked away until tapped (mobile-friendly).
  const [showText, setShowText] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showNotes, setShowNotes] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogInitialName, setDialogInitialName] = useState("");
  const pendingFoodId = useRef<Id<"foods"> | null>(null);

  function addDraft(d: Omit<Draft, "key">) {
    setDrafts((prev) => [...prev, { ...d, key: nextKey() }]);
  }
  function updateDraft(key: number, patch: Partial<Draft>) {
    setDrafts((prev) => prev.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  }
  function removeDraft(key: number) {
    setDrafts((prev) => prev.filter((d) => d.key !== key));
  }

  function addFood(food: Food) {
    addDraft({
      foodId: food._id,
      name: food.name,
      unit: food.unit,
      quantity: 1,
      calories: food.calories,
      protein: food.protein,
      carbs: food.carbs,
      fat: food.fat,
    });
  }

  function addMealItems(items: MealItem[]) {
    items.forEach((it) =>
      addDraft({
        foodId: it.foodId,
        name: it.name,
        unit: it.unit,
        quantity: it.quantity,
        calories: it.calories,
        protein: it.protein,
        carbs: it.carbs,
        fat: it.fat,
      }),
    );
  }

  // When a food is created from the "create new" flow, add it to the draft
  // once it shows up in the live foods list.
  useEffect(() => {
    if (!pendingFoodId.current || !foods) return;
    const food = foods.find((f) => f._id === pendingFoodId.current);
    if (food) {
      addFood(food);
      pendingFoodId.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [foods]);

  async function runParse(input: {
    text?: string;
    audio?: { data: string; format: string };
  }) {
    setParsing(true);
    setParseError(null);
    try {
      const { items } = await parseMeal(input);
      if (items.length === 0) {
        setParseError("Couldn't find any foods in that. Try rephrasing.");
        return;
      }
      items.forEach((it) => addDraft({ foodId: null, ...it }));
      setText("");
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setParsing(false);
    }
  }

  function onEstimate() {
    const t = text.trim();
    if (!t) return;
    void runParse({ text: t });
  }

  function onVoice(audioBase64: string) {
    void runParse({
      text: text.trim() || undefined,
      audio: { data: audioBase64, format: "wav" },
    });
  }

  function enableCustomTime() {
    setWhenValue(toLocalInput(new Date()));
    setCustomTime(true);
  }

  async function onLog() {
    if (drafts.length === 0) return;
    setSubmitting(true);
    try {
      const consumedAt =
        customTime && whenValue ? new Date(whenValue).getTime() : undefined;
      await logItems({
        items: drafts.map((d) => ({
          name: d.name,
          unit: d.unit,
          quantity: d.quantity,
          calories: d.calories,
          protein: d.protein,
          carbs: d.carbs,
          fat: d.fat,
        })),
        notes: notes.trim() || undefined,
        consumedAt,
      });
      setDrafts([]);
      setNotes("");
      setCustomTime(false);
      setWhenValue("");
      setShowText(false);
      setShowSearch(false);
      setShowNotes(false);
    } finally {
      setSubmitting(false);
    }
  }

  const draftTotals = mealTotals(
    drafts.map((d) => ({
      foodId: d.foodId ?? ("" as Id<"foods">),
      name: d.name,
      unit: d.unit,
      quantity: d.quantity,
      calories: d.calories,
      protein: d.protein,
      carbs: d.carbs,
      fat: d.fat,
    })),
  );

  // Most-recently-used foods first, for one-tap chips.
  const recentFoods = (foods ?? []).slice(0, 12);

  return (
    <div className={drafts.length > 0 ? "pb-24 sm:pb-0" : undefined}>
      <div className="mb-5 flex items-start justify-between gap-3 sm:mb-6">
        <PageHeader
          title="Meals"
          description="Just say what you ate — macros are filled in for you."
        />
        <Link
          href="/foods"
          className="mt-1 shrink-0 text-sm text-neutral-500 underline-offset-4 hover:underline"
        >
          Manage foods →
        </Link>
      </div>

      <Card className="mb-6">
        <div className="grid gap-4">
          {/* Voice-first entry */}
          <VoiceButton
            size="lg"
            onResult={onVoice}
            onError={setParseError}
            disabled={parsing}
          />

          {/* Type instead (secondary) */}
          {showText ? (
            <div className="grid gap-2">
              <textarea
                className={`${inputClass} min-h-[64px] w-full resize-none`}
                placeholder="e.g. 2 eggs, toast with butter, a banana"
                value={text}
                onChange={(e) => setText(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") onEstimate();
                }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={onEstimate}
                disabled={!text.trim() || parsing}
              >
                <Sparkles className="mr-1.5 size-4" />
                {parsing ? "Estimating…" : "Estimate macros"}
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowText(true)}
              className="text-center text-xs text-neutral-500 underline-offset-4 hover:underline"
            >
              or type it instead
            </button>
          )}

          {parseError && (
            <p className="text-xs text-red-600 dark:text-red-400">{parseError}</p>
          )}

          {/* Draft items */}
          {drafts.length > 0 && (
            <ul className="grid gap-2 border-t border-neutral-100 pt-4 dark:border-neutral-800">
              {drafts.map((d) => {
                const kcal =
                  d.calories != null ? roundTotal(d.calories * d.quantity) : null;
                return (
                  <li
                    key={d.key}
                    className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-800"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{d.name}</div>
                        <div className="truncate text-xs text-neutral-500">
                          per {d.unit}
                          {d.calories != null && ` · ${roundTotal(d.calories)} kcal`}
                          {d.protein != null && ` · P ${roundTotal(d.protein)}g`}
                          {d.carbs != null && ` · C ${roundTotal(d.carbs)}g`}
                          {d.fat != null && ` · F ${roundTotal(d.fat)}g`}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeDraft(d.key)}
                        aria-label="Remove item"
                        className="-mr-1 -mt-1 flex size-9 shrink-0 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-xs text-neutral-500">
                        {kcal != null ? `≈ ${kcal} kcal` : " "}
                      </span>
                      <QuantityStepper
                        value={d.quantity}
                        onChange={(q) => updateDraft(d.key, { quantity: q })}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Add from your foods */}
          {(recentFoods.length > 0 || (foods?.length ?? 0) > 0) && (
            <div className="grid gap-3 border-t border-neutral-100 pt-4 dark:border-neutral-800">
              {recentFoods.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {recentFoods.map((f) => (
                    <button
                      key={f._id}
                      type="button"
                      onClick={() => addFood(f)}
                      className="rounded-full border border-neutral-200 px-3.5 py-2 text-sm text-neutral-700 hover:border-neutral-400 hover:bg-neutral-50 active:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:border-neutral-500 dark:hover:bg-neutral-800"
                    >
                      + {f.name}
                    </button>
                  ))}
                </div>
              )}
              {showSearch ? (
                <SearchableCombobox<Id<"foods">>
                  items={(foods ?? []).map((f) => ({
                    id: f._id,
                    label: f.name,
                    sublabel: `per ${f.unit}${f.calories != null ? ` · ${f.calories} kcal` : ""}`,
                    searchValue: `${f.name} ${f.unit}`,
                  }))}
                  value={null}
                  onSelect={(id) => {
                    const f = (foods ?? []).find((x) => x._id === id);
                    if (f) addFood(f);
                  }}
                  onCreateNew={(name) => {
                    setDialogInitialName(name);
                    setDialogOpen(true);
                  }}
                  placeholder="Search your foods…"
                  emptyText="No matching food."
                  createLabel="Add a new food…"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setShowSearch(true)}
                  className="self-start text-xs text-neutral-500 underline-offset-4 hover:underline"
                >
                  Search all foods…
                </button>
              )}
            </div>
          )}

          {/* Time + notes */}
          <div className="flex flex-wrap items-center gap-2">
            {customTime ? (
              <div className="flex w-full flex-wrap items-center gap-2">
                <Clock className="size-4 text-neutral-400" />
                <input
                  type="datetime-local"
                  className={inputClass}
                  value={whenValue}
                  max={toLocalInput(new Date())}
                  onChange={(e) => setWhenValue(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setCustomTime(false)}
                  className="text-xs text-neutral-500 underline-offset-4 hover:underline"
                >
                  Use now
                </button>
              </div>
            ) : (
              <button type="button" onClick={enableCustomTime} className={chipClass}>
                <Clock className="size-3.5" />
                Now
              </button>
            )}
            {!showNotes && !notes && (
              <button
                type="button"
                onClick={() => setShowNotes(true)}
                className={chipClass}
              >
                <Plus className="size-3.5" />
                Note
              </button>
            )}
          </div>
          {(showNotes || notes) && (
            <input
              className={inputClass}
              placeholder="Notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              autoFocus
            />
          )}

          {/* Inline log (desktop; mobile uses the sticky bar) */}
          <Button
            type="button"
            onClick={onLog}
            disabled={drafts.length === 0 || submitting}
            className="hidden sm:flex"
          >
            {submitting ? "Logging…" : "Log meal"}
          </Button>
        </div>
      </Card>

      <Card>
        {meals === undefined ? (
          <p className="text-sm text-neutral-400">Loading…</p>
        ) : meals.length === 0 ? (
          <p className="text-sm text-neutral-400">No meals yet.</p>
        ) : (
          <ul className="divide-y divide-neutral-100 text-sm dark:divide-neutral-800">
            {meals.map((m) => {
              const totals = mealTotals(m.items);
              return (
                <li key={m._id} className="py-3">
                  <div className="font-medium">
                    {m.items.map((it) => it.name).join(" + ") || "Meal"}
                  </div>
                  <div className="mt-0.5 text-xs text-neutral-500">
                    {formatDate(m.consumedAt)}
                  </div>
                  {(totals.calories > 0 ||
                    totals.protein > 0 ||
                    totals.carbs > 0 ||
                    totals.fat > 0) && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {totals.calories > 0 && (
                        <span className={pillClass}>{roundTotal(totals.calories)} kcal</span>
                      )}
                      {totals.protein > 0 && (
                        <span className={pillClass}>P {roundTotal(totals.protein)}g</span>
                      )}
                      {totals.carbs > 0 && (
                        <span className={pillClass}>C {roundTotal(totals.carbs)}g</span>
                      )}
                      {totals.fat > 0 && (
                        <span className={pillClass}>F {roundTotal(totals.fat)}g</span>
                      )}
                    </div>
                  )}
                  <div className="mt-1.5 text-xs text-neutral-500">
                    {m.items
                      .map((it) => `${formatQty(it.quantity, it.unit)} ${it.name}`)
                      .join(", ")}
                  </div>
                  {m.notes && (
                    <div className="mt-1 text-xs text-neutral-500">{m.notes}</div>
                  )}
                  <div className="mt-2.5 flex gap-2">
                    <button
                      onClick={() => addMealItems(m.items)}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-neutral-200 py-2 text-xs font-medium text-neutral-700 hover:border-neutral-400 hover:bg-neutral-50 active:bg-neutral-100 sm:flex-none sm:px-3 dark:border-neutral-700 dark:text-neutral-200 dark:hover:border-neutral-600 dark:hover:bg-neutral-800"
                    >
                      <RotateCcw className="size-3.5" />
                      Repeat
                    </button>
                    <button
                      onClick={() => removeMeal({ id: m._id })}
                      className={dangerButtonClass}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <FoodDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialName={dialogInitialName}
        onCreated={(id) => {
          pendingFoodId.current = id;
        }}
      />

      {/* Sticky log bar (mobile only) */}
      {drafts.length > 0 && (
        <div
          className="fixed inset-x-0 z-30 border-t border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur sm:hidden dark:border-neutral-800 dark:bg-neutral-950/95"
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 3.5rem)" }}
        >
          <Button
            type="button"
            onClick={onLog}
            disabled={submitting}
            className="h-12 w-full text-base"
          >
            {submitting
              ? "Logging…"
              : `Log meal · ≈ ${roundTotal(draftTotals.calories)} kcal`}
          </Button>
        </div>
      )}
    </div>
  );
}
