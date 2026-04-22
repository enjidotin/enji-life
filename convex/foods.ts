import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    return await ctx.db
      .query("foods")
      .withIndex("by_user_name", (q) => q.eq("userId", userId))
      .take(500);
  },
});

export const add = mutation({
  args: {
    name: v.string(),
    unit: v.string(),
    calories: v.optional(v.number()),
    protein: v.optional(v.number()),
    carbs: v.optional(v.number()),
    fat: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    return await ctx.db.insert("foods", {
      userId,
      name: args.name.trim(),
      unit: args.unit.trim(),
      calories: args.calories,
      protein: args.protein,
      carbs: args.carbs,
      fat: args.fat,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("foods"),
    name: v.string(),
    unit: v.string(),
    calories: v.optional(v.number()),
    protein: v.optional(v.number()),
    carbs: v.optional(v.number()),
    fat: v.optional(v.number()),
  },
  handler: async (ctx, { id, ...patch }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const food = await ctx.db.get(id);
    if (!food || food.userId !== userId) throw new Error("Not found");
    await ctx.db.patch(id, {
      name: patch.name.trim(),
      unit: patch.unit.trim(),
      calories: patch.calories,
      protein: patch.protein,
      carbs: patch.carbs,
      fat: patch.fat,
    });
  },
});

export const remove = mutation({
  args: { id: v.id("foods") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const food = await ctx.db.get(id);
    if (!food || food.userId !== userId) throw new Error("Not found");
    await ctx.db.delete(id);
  },
});
