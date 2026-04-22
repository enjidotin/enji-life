import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    return await ctx.db
      .query("exercises")
      .withIndex("by_user_name", (q) => q.eq("userId", userId))
      .take(500);
  },
});

export const add = mutation({
  args: {
    name: v.string(),
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    return await ctx.db.insert("exercises", {
      userId,
      name: args.name.trim(),
      category: args.category?.trim() || undefined,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("exercises"),
    name: v.string(),
    category: v.optional(v.string()),
  },
  handler: async (ctx, { id, name, category }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const row = await ctx.db.get(id);
    if (!row || row.userId !== userId) throw new Error("Not found");
    await ctx.db.patch(id, {
      name: name.trim(),
      category: category?.trim() || undefined,
    });
  },
});

export const remove = mutation({
  args: { id: v.id("exercises") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const row = await ctx.db.get(id);
    if (!row || row.userId !== userId) throw new Error("Not found");
    await ctx.db.delete(id);
  },
});
