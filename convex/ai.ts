import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";

// Cheap, fast, and supports text + audio input. Override with
// `npx convex env set OPENROUTER_MODEL ...`.
const DEFAULT_MODEL = "google/gemini-3.1-flash-lite-preview";

type AudioArg = { data: string; format: string } | undefined;

type UserContent =
  | string
  | Array<
      | { type: "text"; text: string }
      | { type: "input_audio"; input_audio: { data: string; format: string } }
    >;

// Build the user message: spoken audio (optionally with typed text) or plain text.
function buildUserContent(text: string, audio: AudioArg, audioHint: string): UserContent {
  if (audio) {
    return [
      { type: "text", text: text || audioHint },
      { type: "input_audio", input_audio: { data: audio.data, format: audio.format } },
    ];
  }
  return text;
}

async function callOpenRouter(opts: {
  system: string;
  context?: string;
  userContent: UserContent;
  schemaName: string;
  schema: unknown;
}): Promise<Record<string, unknown>> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OpenRouter is not configured. Run: npx convex env set OPENROUTER_API_KEY <key>",
    );
  }
  const model = process.env.OPENROUTER_MODEL ?? DEFAULT_MODEL;

  const messages: Array<{ role: string; content: UserContent }> = [
    { role: "system", content: opts.system },
  ];
  if (opts.context) messages.push({ role: "system", content: opts.context });
  messages.push({ role: "user", content: opts.userContent });

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.2,
      response_format: {
        type: "json_schema",
        json_schema: { name: opts.schemaName, strict: true, schema: opts.schema },
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenRouter request failed (${res.status}): ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  const content: string | undefined = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenRouter returned no content");
  try {
    return JSON.parse(content);
  } catch {
    throw new Error("Could not parse the response. Try rephrasing.");
  }
}

const num = (x: unknown) => (typeof x === "number" && isFinite(x) ? x : 0);
const optNum = (x: unknown) =>
  typeof x === "number" && isFinite(x) && x > 0 ? x : undefined;

// Validate a model-produced local timestamp ("YYYY-MM-DDTHH:mm").
function parseDateTime(x: unknown): string | undefined {
  return typeof x === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(x.trim())
    ? x.trim().slice(0, 16)
    : undefined;
}

// Prepend the user's current local time so the model can resolve "8am",
// "yesterday", etc., then append any history context.
function withNow(nowLocal: string | undefined, history: string | undefined) {
  const parts = [
    nowLocal
      ? `Current local date-time is ${nowLocal} (format YYYY-MM-DDTHH:mm, 24-hour). Resolve any relative times the user says against this.`
      : null,
    history ?? null,
  ].filter((x): x is string => !!x);
  return parts.length ? parts.join("\n\n") : undefined;
}

// ---------------------------------------------------------------------------
// Meals
// ---------------------------------------------------------------------------

const MEAL_RULES = `- One entry per distinct food.
- "name": a short, reusable food name in Title Case (e.g. "Egg", "Whole Wheat Toast", "Banana"). No quantities in the name.
- "unit": the natural single unit for that food ("egg", "slice", "cup", "serving", "g", "piece", "tbsp", etc.). Default to "serving" if unsure.
- "quantity": how many of that unit the user ate (a number, may be fractional).
- "calories", "protein", "carbs", "fat": estimated macros for ONE single unit (not the total). protein/carbs/fat are grams. Be realistic; round sensibly.
- If the user gives a weight like "200g chicken", use unit "g", quantity 200, and per-gram macros.
- You may be given the user's food library and recent meals as context. If the user refers to "my usual breakfast", "the same as yesterday", etc., reconstruct it from that history. Prefer the user's known foods (and their macros/units) when a food matches.
- "consumedAt": if the user mentions WHEN they ate (e.g. "this morning", "at 8am", "yesterday at lunch", "an hour ago", "noon"), resolve it against the current local date-time given in context and return it as a local timestamp in "YYYY-MM-DDTHH:mm" 24-hour format. If no time is mentioned, return null.`;

const MEAL_SYSTEM = `You are a nutrition estimator. The user describes a meal in plain language. Break it into individual food items and estimate macros.

Rules:
${MEAL_RULES}
Return ONLY the structured data.`;

const MEAL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    consumedAt: { type: ["string", "null"] },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          unit: { type: "string" },
          quantity: { type: "number" },
          calories: { type: "number" },
          protein: { type: "number" },
          carbs: { type: "number" },
          fat: { type: "number" },
        },
        required: ["name", "unit", "quantity", "calories", "protein", "carbs", "fat"],
      },
    },
  },
  required: ["consumedAt", "items"],
} as const;

export type ParsedMealItem = {
  name: string;
  unit: string;
  quantity: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

function normalizeMealItems(raw: unknown): ParsedMealItem[] {
  const rawItems = Array.isArray(raw) ? raw : [];
  return rawItems
    .map((it): ParsedMealItem | null => {
      if (typeof it !== "object" || it === null) return null;
      const r = it as Record<string, unknown>;
      const name = typeof r.name === "string" ? r.name.trim() : "";
      if (!name) return null;
      const quantity = num(r.quantity);
      return {
        name,
        unit: typeof r.unit === "string" && r.unit.trim() ? r.unit.trim() : "serving",
        quantity: quantity > 0 ? quantity : 1,
        calories: Math.max(0, num(r.calories)),
        protein: Math.max(0, num(r.protein)),
        carbs: Math.max(0, num(r.carbs)),
        fat: Math.max(0, num(r.fat)),
      };
    })
    .filter((x): x is ParsedMealItem => x !== null);
}

function isoDate(ms: number) {
  return new Date(ms).toISOString().slice(0, 10);
}

type MealContext = {
  meals: Array<{
    consumedAt: number;
    notes?: string;
    items: Array<{
      name: string;
      unit: string;
      quantity: number;
      calories?: number;
      protein?: number;
      carbs?: number;
      fat?: number;
    }>;
  }>;
  foods: Array<{
    name: string;
    unit: string;
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
  }>;
};

function formatMealContext(ctx: MealContext): string | undefined {
  if (ctx.foods.length === 0 && ctx.meals.length === 0) return undefined;
  const lines: string[] = [];
  if (ctx.foods.length > 0) {
    lines.push("User's food library (name · unit · per-unit kcal/P/C/F):");
    for (const f of ctx.foods) {
      lines.push(
        `- ${f.name} · ${f.unit} · ${f.calories ?? "?"}kcal P${f.protein ?? "?"} C${f.carbs ?? "?"} F${f.fat ?? "?"}`,
      );
    }
  }
  if (ctx.meals.length > 0) {
    lines.push("", "Recent meals (most recent first):");
    for (const m of ctx.meals) {
      const items = m.items.map((it) => `${it.quantity}× ${it.name}`).join(", ");
      lines.push(`- ${isoDate(m.consumedAt)}: ${items}${m.notes ? ` (${m.notes})` : ""}`);
    }
  }
  return lines.join("\n");
}

export const parseMeal = action({
  args: {
    text: v.optional(v.string()),
    audio: v.optional(v.object({ data: v.string(), format: v.string() })),
    nowLocal: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { text, audio, nowLocal },
  ): Promise<{ items: ParsedMealItem[]; consumedAt?: string }> => {
    const trimmed = (text ?? "").trim();
    if (!trimmed && !audio) return { items: [] };

    const context: MealContext = await ctx.runQuery(internal.meals.aiContext, {});
    const parsed = await callOpenRouter({
      system: MEAL_SYSTEM,
      context: withNow(nowLocal, formatMealContext(context)),
      userContent: buildUserContent(
        trimmed,
        audio,
        "This audio describes a meal I ate. Extract the foods.",
      ),
      schemaName: "meal",
      schema: MEAL_SCHEMA,
    });

    return {
      items: normalizeMealItems(parsed.items),
      consumedAt: parseDateTime(parsed.consumedAt),
    };
  },
});

// ---------------------------------------------------------------------------
// Workouts
// ---------------------------------------------------------------------------

const WORKOUT_RULES = `- "name": a short exercise name in Title Case (e.g. "Bench Press", "Incline Dumbbell Press", "Lat Pulldown").
- "category": the muscle group or type if known ("Chest", "Back", "Legs", "Shoulders", "Arms", "Core", "Cardio"), else null.
- "maxWeight": the top working weight as a number in the user's usual units, or null if not stated/unknown.
- "totalReps": total reps across all sets for that exercise, or null if unknown.
- "durationMinutes": total session length in minutes if mentioned, else null.
- You may be given the user's exercise library and recent workouts as context. If the user refers to "the usual chest day", "same as last time", a named routine, etc., reconstruct the exercise list (and typical weights/reps) from that history. Prefer exercise names from the user's library when they match.
- "performedAt": if the user mentions WHEN they trained (e.g. "this morning", "yesterday evening", "an hour ago"), resolve it against the current local date-time given in context and return it as a local timestamp in "YYYY-MM-DDTHH:mm" 24-hour format. If no time is mentioned, return null.`;

const WORKOUT_SYSTEM = `You are a workout logger. The user describes a training session in plain language (possibly something like "the usual chest day" or "same as last leg day"). Break it into exercises.

Rules:
${WORKOUT_RULES}
Return ONLY the structured data.`;

const WORKOUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    durationMinutes: { type: ["number", "null"] },
    performedAt: { type: ["string", "null"] },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          category: { type: ["string", "null"] },
          maxWeight: { type: ["number", "null"] },
          totalReps: { type: ["number", "null"] },
        },
        required: ["name", "category", "maxWeight", "totalReps"],
      },
    },
  },
  required: ["durationMinutes", "performedAt", "items"],
} as const;

export type ParsedWorkoutItem = {
  name: string;
  category?: string;
  maxWeight?: number;
  totalReps?: number;
};

function normalizeWorkoutItems(raw: unknown): ParsedWorkoutItem[] {
  const rawItems = Array.isArray(raw) ? raw : [];
  return rawItems
    .map((it): ParsedWorkoutItem | null => {
      if (typeof it !== "object" || it === null) return null;
      const r = it as Record<string, unknown>;
      const name = typeof r.name === "string" ? r.name.trim() : "";
      if (!name) return null;
      return {
        name,
        category:
          typeof r.category === "string" && r.category.trim()
            ? r.category.trim()
            : undefined,
        maxWeight: optNum(r.maxWeight),
        totalReps: optNum(r.totalReps),
      };
    })
    .filter((x): x is ParsedWorkoutItem => x !== null);
}

type WorkoutContext = {
  workouts: Array<{
    performedAt: number;
    durationMinutes?: number;
    notes?: string;
    items: Array<{
      name: string;
      category?: string;
      maxWeight?: number;
      totalReps?: number;
    }>;
  }>;
  exercises: Array<{ name: string; category?: string }>;
};

function formatWorkoutContext(ctx: WorkoutContext): string | undefined {
  if (ctx.exercises.length === 0 && ctx.workouts.length === 0) return undefined;
  const lines: string[] = [];
  if (ctx.exercises.length > 0) {
    lines.push("User's exercise library (name · category):");
    for (const e of ctx.exercises) lines.push(`- ${e.name}${e.category ? ` · ${e.category}` : ""}`);
  }
  if (ctx.workouts.length > 0) {
    lines.push("", "Recent workouts (most recent first):");
    for (const w of ctx.workouts) {
      const items = w.items
        .map((it) => {
          const w2 = it.maxWeight != null ? ` ${it.maxWeight}` : "";
          const r = it.totalReps != null ? `×${it.totalReps}` : "";
          return `${it.name}${w2}${r}`;
        })
        .join(", ");
      const dur = w.durationMinutes != null ? ` [${w.durationMinutes}min]` : "";
      lines.push(`- ${isoDate(w.performedAt)}${dur}: ${items}${w.notes ? ` (${w.notes})` : ""}`);
    }
  }
  return lines.join("\n");
}

export const parseWorkout = action({
  args: {
    text: v.optional(v.string()),
    audio: v.optional(v.object({ data: v.string(), format: v.string() })),
    nowLocal: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { text, audio, nowLocal },
  ): Promise<{
    items: ParsedWorkoutItem[];
    durationMinutes?: number;
    performedAt?: string;
  }> => {
    const trimmed = (text ?? "").trim();
    if (!trimmed && !audio) return { items: [] };

    const context: WorkoutContext = await ctx.runQuery(internal.workouts.aiContext, {});
    const parsed = await callOpenRouter({
      system: WORKOUT_SYSTEM,
      context: withNow(nowLocal, formatWorkoutContext(context)),
      userContent: buildUserContent(
        trimmed,
        audio,
        "This audio describes a workout I did. Extract the exercises.",
      ),
      schemaName: "workout",
      schema: WORKOUT_SCHEMA,
    });

    return {
      items: normalizeWorkoutItems(parsed.items),
      durationMinutes: optNum(parsed.durationMinutes),
      performedAt: parseDateTime(parsed.performedAt),
    };
  },
});

// ---------------------------------------------------------------------------
// Unified quick log (dashboard: speak once, we figure out what it is)
// ---------------------------------------------------------------------------

const LOG_SYSTEM = `You are the quick-log assistant for a personal fitness app. The user speaks (or types) ONE log entry. First decide what they are logging, then extract it.

Classification ("kind"):
- "meal": food or drink they consumed.
- "workout": a training session or exercises they performed.
- "weight": a body-weight measurement (e.g. "I'm at 82.4 this morning", "weighed in at 180 pounds").
- "unknown": none of the above, or you cannot tell.

Fill ONLY the object matching "kind"; set the other two to null. If kind is "unknown", set all three to null.

For "meal", follow these rules:
${MEAL_RULES}

For "workout", follow these rules:
${WORKOUT_RULES}

For "weight":
- "weight": the measurement as a number.
- "unit": "kg" or "lb" if stated or clearly implied, else null.
- "loggedAt": if the user mentions WHEN they weighed in, resolve it against the current local date-time given in context and return it as a local "YYYY-MM-DDTHH:mm" timestamp; else null.

Return ONLY the structured data.`;

const LOG_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    kind: { type: "string", enum: ["meal", "workout", "weight", "unknown"] },
    meal: { ...MEAL_SCHEMA, type: ["object", "null"] },
    workout: { ...WORKOUT_SCHEMA, type: ["object", "null"] },
    weight: {
      type: ["object", "null"],
      additionalProperties: false,
      properties: {
        weight: { type: "number" },
        unit: { type: ["string", "null"] },
        loggedAt: { type: ["string", "null"] },
      },
      required: ["weight", "unit", "loggedAt"],
    },
  },
  required: ["kind", "meal", "workout", "weight"],
} as const;

export type ParsedLog =
  | { kind: "meal"; items: ParsedMealItem[]; consumedAt?: string }
  | {
      kind: "workout";
      items: ParsedWorkoutItem[];
      durationMinutes?: number;
      performedAt?: string;
    }
  | { kind: "weight"; weight: number; unit?: "kg" | "lb"; loggedAt?: string }
  | { kind: "none" };

export const parseLog = action({
  args: {
    text: v.optional(v.string()),
    audio: v.optional(v.object({ data: v.string(), format: v.string() })),
    nowLocal: v.optional(v.string()),
  },
  handler: async (ctx, { text, audio, nowLocal }): Promise<ParsedLog> => {
    const trimmed = (text ?? "").trim();
    if (!trimmed && !audio) return { kind: "none" };

    const mealCtx: MealContext = await ctx.runQuery(internal.meals.aiContext, {});
    const workoutCtx: WorkoutContext = await ctx.runQuery(
      internal.workouts.aiContext,
      {},
    );
    const history = [formatMealContext(mealCtx), formatWorkoutContext(workoutCtx)]
      .filter((x): x is string => !!x)
      .join("\n\n");

    const parsed = await callOpenRouter({
      system: LOG_SYSTEM,
      context: withNow(nowLocal, history || undefined),
      userContent: buildUserContent(
        trimmed,
        audio,
        "This audio is one log entry: a meal, a workout, or a body-weight measurement. Identify which and extract it.",
      ),
      schemaName: "log",
      schema: LOG_SCHEMA,
    });

    if (parsed.kind === "meal" && parsed.meal && typeof parsed.meal === "object") {
      const m = parsed.meal as Record<string, unknown>;
      const items = normalizeMealItems(m.items);
      if (items.length > 0)
        return { kind: "meal", items, consumedAt: parseDateTime(m.consumedAt) };
    }

    if (
      parsed.kind === "workout" &&
      parsed.workout &&
      typeof parsed.workout === "object"
    ) {
      const w = parsed.workout as Record<string, unknown>;
      const items = normalizeWorkoutItems(w.items);
      if (items.length > 0)
        return {
          kind: "workout",
          items,
          durationMinutes: optNum(w.durationMinutes),
          performedAt: parseDateTime(w.performedAt),
        };
    }

    if (
      parsed.kind === "weight" &&
      parsed.weight &&
      typeof parsed.weight === "object"
    ) {
      const r = parsed.weight as Record<string, unknown>;
      const value = optNum(r.weight);
      const unit = r.unit === "kg" || r.unit === "lb" ? r.unit : undefined;
      if (value)
        return { kind: "weight", weight: value, unit, loggedAt: parseDateTime(r.loggedAt) };
    }

    return { kind: "none" };
  },
});
