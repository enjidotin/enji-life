import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internalQuery, mutation, query } from "./_generated/server";

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

// Log a workout from free-form items (AI-parsed or repeated). Each item is
// matched to a library exercise by name, creating it if missing.
export const logItems = mutation({
  args: {
    items: v.array(
      v.object({
        name: v.string(),
        category: v.optional(v.string()),
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

    const snapshotItems = [];
    for (const item of args.items) {
      const name = item.name.trim();
      if (!name) continue;

      const existing = await ctx.db
        .query("exercises")
        .withIndex("by_user_name", (q) => q.eq("userId", userId).eq("name", name))
        .first();

      let exerciseId = existing?._id;
      const category = existing?.category ?? (item.category?.trim() || undefined);
      if (!exerciseId) {
        exerciseId = await ctx.db.insert("exercises", { userId, name, category });
      }

      snapshotItems.push({
        exerciseId,
        name: existing?.name ?? name,
        category,
        maxWeight: item.maxWeight,
        totalReps: item.totalReps,
      });
    }

    if (snapshotItems.length === 0)
      throw new Error("Workout must have at least one exercise");

    return await ctx.db.insert("workouts", {
      userId,
      items: snapshotItems,
      durationMinutes: args.durationMinutes,
      notes: args.notes,
      performedAt: args.performedAt ?? Date.now(),
    });
  },
});

// Recent history + full exercise library, for the AI parser's context.
export const aiContext = internalQuery({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return { workouts: [], exercises: [] };
    const workouts = await ctx.db
      .query("workouts")
      .withIndex("by_user_time", (q) => q.eq("userId", userId))
      .order("desc")
      .take(30);
    const exercises = await ctx.db
      .query("exercises")
      .withIndex("by_user_name", (q) => q.eq("userId", userId))
      .take(500);
    return {
      workouts: workouts.map((w) => ({
        performedAt: w.performedAt,
        durationMinutes: w.durationMinutes,
        notes: w.notes,
        items: w.items.map((it) => ({
          name: it.name,
          category: it.category,
          maxWeight: it.maxWeight,
          totalReps: it.totalReps,
        })),
      })),
      exercises: exercises.map((e) => ({ name: e.name, category: e.category })),
    };
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
