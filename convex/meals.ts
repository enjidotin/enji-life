import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";

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
