import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internalQuery, mutation, query } from "./_generated/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    return await ctx.db
      .query("meals")
      .withIndex("by_user_time", (q) => q.eq("userId", userId))
      .order("desc")
      .take(100);
  },
});

export const add = mutation({
  args: {
    items: v.array(
      v.object({
        foodId: v.id("foods"),
        quantity: v.number(),
      }),
    ),
    notes: v.optional(v.string()),
    consumedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    if (args.items.length === 0) throw new Error("Meal must have at least one item");

    const snapshotItems = await Promise.all(
      args.items.map(async ({ foodId, quantity }) => {
        const food = await ctx.db.get(foodId);
        if (!food || food.userId !== userId) throw new Error("Food not found");
        return {
          foodId,
          name: food.name,
          unit: food.unit,
          quantity,
          calories: food.calories,
          protein: food.protein,
          carbs: food.carbs,
          fat: food.fat,
        };
      }),
    );

    return await ctx.db.insert("meals", {
      userId,
      items: snapshotItems,
      notes: args.notes,
      consumedAt: args.consumedAt ?? Date.now(),
    });
  },
});

// Log a meal from free-form items (e.g. AI-estimated or repeated from history).
// Each item is matched to a library food by name, creating it if missing, so
// every logged food becomes reusable next time.
export const logItems = mutation({
  args: {
    items: v.array(
      v.object({
        name: v.string(),
        unit: v.string(),
        quantity: v.number(),
        calories: v.optional(v.number()),
        protein: v.optional(v.number()),
        carbs: v.optional(v.number()),
        fat: v.optional(v.number()),
      }),
    ),
    notes: v.optional(v.string()),
    consumedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    if (args.items.length === 0) throw new Error("Meal must have at least one item");

    const snapshotItems = [];
    for (const item of args.items) {
      const name = item.name.trim();
      if (!name || item.quantity <= 0) continue;

      const existing = await ctx.db
        .query("foods")
        .withIndex("by_user_name", (q) => q.eq("userId", userId).eq("name", name))
        .first();

      let foodId = existing?._id;
      // Reuse the library food's macros for consistency; create it if new.
      const food = existing ?? {
        name,
        unit: item.unit.trim() || "serving",
        calories: item.calories,
        protein: item.protein,
        carbs: item.carbs,
        fat: item.fat,
      };
      if (!foodId) {
        foodId = await ctx.db.insert("foods", { userId, ...food });
      }

      snapshotItems.push({
        foodId,
        name: food.name,
        unit: food.unit,
        quantity: item.quantity,
        calories: food.calories,
        protein: food.protein,
        carbs: food.carbs,
        fat: food.fat,
      });
    }

    if (snapshotItems.length === 0) throw new Error("Meal must have at least one item");

    return await ctx.db.insert("meals", {
      userId,
      items: snapshotItems,
      notes: args.notes,
      consumedAt: args.consumedAt ?? Date.now(),
    });
  },
});

// Recent history + full food library, for the AI parser's context.
export const aiContext = internalQuery({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return { meals: [], foods: [] };
    const meals = await ctx.db
      .query("meals")
      .withIndex("by_user_time", (q) => q.eq("userId", userId))
      .order("desc")
      .take(30);
    const foods = await ctx.db
      .query("foods")
      .withIndex("by_user_name", (q) => q.eq("userId", userId))
      .take(500);
    return {
      meals: meals.map((m) => ({
        consumedAt: m.consumedAt,
        notes: m.notes,
        items: m.items.map((it) => ({
          name: it.name,
          unit: it.unit,
          quantity: it.quantity,
          calories: it.calories,
          protein: it.protein,
          carbs: it.carbs,
          fat: it.fat,
        })),
      })),
      foods: foods.map((f) => ({
        name: f.name,
        unit: f.unit,
        calories: f.calories,
        protein: f.protein,
        carbs: f.carbs,
        fat: f.fat,
      })),
    };
  },
});

export const remove = mutation({
  args: { id: v.id("meals") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const meal = await ctx.db.get(id);
    if (!meal || meal.userId !== userId) throw new Error("Not found");
    await ctx.db.delete(id);
  },
});
