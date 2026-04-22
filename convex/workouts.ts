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
    items: v.array(
      v.object({
        exerciseId: v.id("exercises"),
        maxWeight: v.optional(v.number()),
        totalReps: v.optional(v.number()),
      }),
    ),
    durationMinutes: v.optional(v.number()),
    notes: v.optional(v.string()),
    performedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    if (args.items.length === 0)
      throw new Error("Workout must have at least one exercise");

    const snapshotItems = await Promise.all(
      args.items.map(async ({ exerciseId, maxWeight, totalReps }) => {
        const ex = await ctx.db.get(exerciseId);
        if (!ex || ex.userId !== userId) throw new Error("Exercise not found");
        return {
          exerciseId,
          name: ex.name,
          category: ex.category,
          maxWeight,
          totalReps,
        };
      }),
    );

    return await ctx.db.insert("workouts", {
      userId,
      items: snapshotItems,
      durationMinutes: args.durationMinutes,
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
