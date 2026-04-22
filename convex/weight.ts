import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    return await ctx.db
      .query("weightLogs")
      .withIndex("by_user_time", (q) => q.eq("userId", userId))
      .order("desc")
      .take(365);
  },
});

export const add = mutation({
  args: {
    weight: v.number(),
    unit: v.union(v.literal("kg"), v.literal("lb")),
    notes: v.optional(v.string()),
    loggedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    return await ctx.db.insert("weightLogs", {
      userId,
      weight: args.weight,
      unit: args.unit,
      notes: args.notes,
      loggedAt: args.loggedAt ?? Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("weightLogs") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const row = await ctx.db.get(id);
    if (!row || row.userId !== userId) throw new Error("Not found");
    await ctx.db.delete(id);
  },
});
