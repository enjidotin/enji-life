import { v } from "convex/values";
import { action } from "./_generated/server";

// Cheap, fast, and supports text + audio input. Override with
// `npx convex env set OPENROUTER_MODEL ...`.
const DEFAULT_MODEL = "google/gemini-3.5-flash";

const SYSTEM_PROMPT = `You are a nutrition estimator. The user describes a meal in plain language. Break it into individual food items and estimate macros.

Rules:
- One entry per distinct food. "Toast with butter" can be one item ("Buttered toast") or two — use judgement.
- "name": a short, reusable food name in Title Case (e.g. "Egg", "Whole Wheat Toast", "Banana"). No quantities in the name.
- "unit": the natural single unit for that food ("egg", "slice", "cup", "serving", "g", "piece", "tbsp", etc.). Default to "serving" if unsure.
- "quantity": how many of that unit the user ate (a number, may be fractional).
- "calories", "protein", "carbs", "fat": estimated macros for ONE single unit (not the total). protein/carbs/fat are grams. Be realistic; round sensibly.
- If the user gives a weight like "200g chicken", use unit "g", quantity 200, and per-gram macros.
Return ONLY the structured data.`;

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
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
  required: ["items"],
} as const;

export type ParsedItem = {
  name: string;
  unit: string;
  quantity: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

export const parseMeal = action({
  args: {
    text: v.optional(v.string()),
    // Spoken description: base64-encoded audio + its format (e.g. "wav", "mp3").
    audio: v.optional(v.object({ data: v.string(), format: v.string() })),
  },
  handler: async (_ctx, { text, audio }): Promise<{ items: ParsedItem[] }> => {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error(
        "OpenRouter is not configured. Run: npx convex env set OPENROUTER_API_KEY <key>",
      );
    }
    const trimmed = (text ?? "").trim();
    if (!trimmed && !audio) return { items: [] };

    const model = process.env.OPENROUTER_MODEL ?? DEFAULT_MODEL;

    const userContent = audio
      ? [
          {
            type: "text",
            text: trimmed || "This audio describes a meal I ate. Extract the foods.",
          },
          { type: "input_audio", input_audio: { data: audio.data, format: audio.format } },
        ]
      : trimmed;

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        temperature: 0.2,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "meal",
            strict: true,
            schema: RESPONSE_SCHEMA,
          },
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

    let parsed: { items?: unknown };
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error("Could not parse the meal. Try rephrasing.");
    }

    const rawItems = Array.isArray(parsed.items) ? parsed.items : [];
    const items: ParsedItem[] = rawItems
      .map((it): ParsedItem | null => {
        if (typeof it !== "object" || it === null) return null;
        const r = it as Record<string, unknown>;
        const name = typeof r.name === "string" ? r.name.trim() : "";
        if (!name) return null;
        const num = (x: unknown) => (typeof x === "number" && isFinite(x) ? x : 0);
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
      .filter((x): x is ParsedItem => x !== null);

    return { items };
  },
});
