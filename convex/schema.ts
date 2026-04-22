import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,

  foods: defineTable({
    userId: v.id("users"),
    name: v.string(),
    unit: v.string(),
    calories: v.optional(v.number()),
    protein: v.optional(v.number()),
    carbs: v.optional(v.number()),
    fat: v.optional(v.number()),
  }).index("by_user_name", ["userId", "name"]),

  meals: defineTable({
    userId: v.id("users"),
    items: v.array(
      v.object({
        foodId: v.id("foods"),
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
    consumedAt: v.number(),
  }).index("by_user_time", ["userId", "consumedAt"]),

  exercises: defineTable({
    userId: v.id("users"),
    name: v.string(),
    category: v.optional(v.string()),
  }).index("by_user_name", ["userId", "name"]),

  workouts: defineTable({
    userId: v.id("users"),
    items: v.array(
      v.object({
        exerciseId: v.id("exercises"),
        name: v.string(),
        category: v.optional(v.string()),
        maxWeight: v.optional(v.number()),
        totalReps: v.optional(v.number()),
      }),
    ),
    durationMinutes: v.optional(v.number()),
    notes: v.optional(v.string()),
    performedAt: v.number(),
  }).index("by_user_time", ["userId", "performedAt"]),

  weightLogs: defineTable({
    userId: v.id("users"),
    weight: v.number(),
    unit: v.union(v.literal("kg"), v.literal("lb")),
    notes: v.optional(v.string()),
    loggedAt: v.number(),
  }).index("by_user_time", ["userId", "loggedAt"]),

  progressPhotos: defineTable({
    userId: v.id("users"),
    storageId: v.id("_storage"),
    caption: v.optional(v.string()),
    weight: v.optional(v.number()),
    takenAt: v.number(),
  }).index("by_user_time", ["userId", "takenAt"]),
});
