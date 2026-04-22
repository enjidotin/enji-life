import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    return await ctx.db
      .query("workouts")
      .withIndex("by_user_time", (q) => q.eq("userId", userId))
      .order("desc")
      .take(100);
  },
});

export const add = mutation({
  args: {
    name: v.string(),
    category: v.optional(v.string()),
    durationMinutes: v.optional(v.number()),
    caloriesBurned: v.optional(v.number()),
    notes: v.optional(v.string()),
    performedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    return await ctx.db.insert("workouts", {
      userId,
      name: args.name,
      category: args.category,
      durationMinutes: args.durationMinutes,
      caloriesBurned: args.caloriesBurned,
      notes: args.notes,
      performedAt: args.performedAt ?? Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("workouts") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const row = await ctx.db.get(id);
    if (!row || row.userId !== userId) throw new Error("Not found");
    await ctx.db.delete(id);
  },
});
