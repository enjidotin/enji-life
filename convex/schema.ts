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

  // --- WHOOP integration -----------------------------------------------

  whoopAccounts: defineTable({
    userId: v.id("users"),
    whoopUserId: v.optional(v.number()),
    accessToken: v.string(),
    refreshToken: v.string(),
    expiresAt: v.number(),
    scopes: v.optional(v.string()),
    lastSyncedAt: v.optional(v.number()),
    syncError: v.optional(v.string()),
  }).index("by_user", ["userId"]),

  // Short-lived CSRF states for the OAuth redirect flow.
  whoopOauthStates: defineTable({
    userId: v.id("users"),
    state: v.string(),
    createdAt: v.number(),
  })
    .index("by_state", ["state"])
    .index("by_user", ["userId"]),

  whoopSleep: defineTable({
    userId: v.id("users"),
    whoopId: v.string(),
    start: v.number(),
    end: v.number(),
    nap: v.boolean(),
    scoreState: v.string(),
    performancePct: v.optional(v.number()),
    efficiencyPct: v.optional(v.number()),
    consistencyPct: v.optional(v.number()),
    respiratoryRate: v.optional(v.number()),
    inBedMilli: v.optional(v.number()),
    awakeMilli: v.optional(v.number()),
    lightMilli: v.optional(v.number()),
    swsMilli: v.optional(v.number()),
    remMilli: v.optional(v.number()),
    sleepCycleCount: v.optional(v.number()),
    disturbanceCount: v.optional(v.number()),
  })
    .index("by_user_whoop", ["userId", "whoopId"])
    .index("by_user_time", ["userId", "start"]),

  whoopWorkouts: defineTable({
    userId: v.id("users"),
    whoopId: v.string(),
    sportName: v.string(),
    start: v.number(),
    end: v.number(),
    scoreState: v.string(),
    strain: v.optional(v.number()),
    avgHeartRate: v.optional(v.number()),
    maxHeartRate: v.optional(v.number()),
    kilojoule: v.optional(v.number()),
    distanceMeter: v.optional(v.number()),
  })
    .index("by_user_whoop", ["userId", "whoopId"])
    .index("by_user_time", ["userId", "start"]),

  // A WHOOP "cycle" is one physiological day (wake to wake) with day strain.
  whoopCycles: defineTable({
    userId: v.id("users"),
    whoopId: v.number(),
    start: v.number(),
    end: v.optional(v.number()),
    scoreState: v.string(),
    strain: v.optional(v.number()),
    kilojoule: v.optional(v.number()),
    avgHeartRate: v.optional(v.number()),
    maxHeartRate: v.optional(v.number()),
  })
    .index("by_user_whoop", ["userId", "whoopId"])
    .index("by_user_time", ["userId", "start"]),

  whoopRecovery: defineTable({
    userId: v.id("users"),
    cycleId: v.number(),
    sleepId: v.string(),
    scoreState: v.string(),
    userCalibrating: v.optional(v.boolean()),
    recoveryScore: v.optional(v.number()),
    restingHeartRate: v.optional(v.number()),
    hrvRmssdMilli: v.optional(v.number()),
    spo2Percentage: v.optional(v.number()),
    skinTempCelsius: v.optional(v.number()),
    recordedAt: v.number(),
  })
    .index("by_user_cycle", ["userId", "cycleId"])
    .index("by_user_time", ["userId", "recordedAt"]),
});
