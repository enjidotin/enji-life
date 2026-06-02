import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type ActionCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { Doc } from "./_generated/dataModel";

// WHOOP API v2 — https://developer.whoop.com/api/
const AUTH_URL = "https://api.prod.whoop.com/oauth/oauth2/auth";
const TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token";
const API_BASE = "https://api.prod.whoop.com/developer";
// `offline` is required to receive a refresh token.
const SCOPES =
  "read:sleep read:workout read:recovery read:cycles read:profile offline";

const DAY_MS = 24 * 60 * 60 * 1000;
// First sync pulls a month of history; later syncs re-fetch a 2-day overlap so
// records that were still being scored pick up their final values.
const INITIAL_SYNC_WINDOW_MS = 30 * DAY_MS;
const RESYNC_OVERLAP_MS = 2 * DAY_MS;
const STATE_TTL_MS = 60 * 60 * 1000;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `WHOOP is not configured. Run: npx convex env set ${name} <value>`,
    );
  }
  return value;
}

// HTTP actions are served from the deployment's .convex.site domain.
function redirectUri(): string {
  return `${requireEnv("CONVEX_SITE_URL")}/whoop/callback`;
}

// ---------------------------------------------------------------------------
// OAuth flow
// ---------------------------------------------------------------------------

export const startAuthorization = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const clientId = requireEnv("WHOOP_CLIENT_ID");

    // One pending state per user.
    const stale = await ctx.db
      .query("whoopOauthStates")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const s of stale) await ctx.db.delete(s._id);

    const state = crypto.randomUUID();
    await ctx.db.insert("whoopOauthStates", {
      userId,
      state,
      createdAt: Date.now(),
    });

    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri(),
      scope: SCOPES,
      state,
    });
    return `${AUTH_URL}?${params.toString()}`;
  },
});

export const consumeOauthState = internalMutation({
  args: { state: v.string() },
  handler: async (ctx, { state }) => {
    const row = await ctx.db
      .query("whoopOauthStates")
      .withIndex("by_state", (q) => q.eq("state", state))
      .unique();
    if (!row) return null;
    await ctx.db.delete(row._id);
    if (Date.now() - row.createdAt > STATE_TTL_MS) return null;
    return row.userId;
  },
});

export const saveAccount = internalMutation({
  args: {
    userId: v.id("users"),
    whoopUserId: v.optional(v.number()),
    accessToken: v.string(),
    refreshToken: v.string(),
    expiresAt: v.number(),
    scopes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("whoopAccounts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { ...args, syncError: undefined });
      return existing._id;
    }
    return await ctx.db.insert("whoopAccounts", args);
  },
});

export const updateTokens = internalMutation({
  args: {
    accountId: v.id("whoopAccounts"),
    accessToken: v.string(),
    refreshToken: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, { accountId, ...tokens }) => {
    await ctx.db.patch(accountId, tokens);
  },
});

export const markSyncResult = internalMutation({
  args: {
    accountId: v.id("whoopAccounts"),
    lastSyncedAt: v.optional(v.number()),
    syncError: v.optional(v.string()),
  },
  handler: async (ctx, { accountId, lastSyncedAt, syncError }) => {
    await ctx.db.patch(accountId, {
      ...(lastSyncedAt !== undefined ? { lastSyncedAt } : {}),
      // Explicit `undefined` clears a previous error.
      syncError,
    });
  },
});

export const deleteAccount = internalMutation({
  args: { accountId: v.id("whoopAccounts") },
  handler: async (ctx, { accountId }) => {
    const account = await ctx.db.get(accountId);
    if (!account) return;
    const states = await ctx.db
      .query("whoopOauthStates")
      .withIndex("by_user", (q) => q.eq("userId", account.userId))
      .collect();
    for (const s of states) await ctx.db.delete(s._id);
    await ctx.db.delete(accountId);
  },
});

export const getAccount = internalQuery({
  args: { accountId: v.id("whoopAccounts") },
  handler: async (ctx, { accountId }) => {
    return await ctx.db.get(accountId);
  },
});

export const accountForUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("whoopAccounts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
  },
});

export const listAccounts = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("whoopAccounts").collect();
  },
});

// ---------------------------------------------------------------------------
// WHOOP HTTP helpers (plain functions, used by actions and the HTTP callback)
// ---------------------------------------------------------------------------

export type WhoopTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope?: string;
};

async function requestToken(
  body: Record<string, string>,
): Promise<WhoopTokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `WHOOP token request failed (${res.status}): ${text.slice(0, 200)}`,
    );
  }
  return (await res.json()) as WhoopTokenResponse;
}

export async function exchangeWhoopCode(
  code: string,
): Promise<WhoopTokenResponse> {
  return requestToken({
    grant_type: "authorization_code",
    code,
    client_id: requireEnv("WHOOP_CLIENT_ID"),
    client_secret: requireEnv("WHOOP_CLIENT_SECRET"),
    redirect_uri: redirectUri(),
  });
}

export async function fetchWhoopProfile(
  accessToken: string,
): Promise<{ user_id?: number } | null> {
  const res = await fetch(`${API_BASE}/v2/user/profile/basic`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  return (await res.json()) as { user_id?: number };
}

// WHOOP rotates refresh tokens: a refresh invalidates the previous pair, so
// the new tokens are persisted immediately. Syncs run sequentially (one cron,
// per-user manual sync), so concurrent refreshes are not a concern here.
async function freshAccessToken(
  ctx: ActionCtx,
  account: Doc<"whoopAccounts">,
): Promise<string> {
  if (account.expiresAt > Date.now() + 5 * 60 * 1000) {
    return account.accessToken;
  }
  const token = await requestToken({
    grant_type: "refresh_token",
    refresh_token: account.refreshToken,
    client_id: requireEnv("WHOOP_CLIENT_ID"),
    client_secret: requireEnv("WHOOP_CLIENT_SECRET"),
    scope: "offline",
  });
  await ctx.runMutation(internal.whoop.updateTokens, {
    accountId: account._id,
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: Date.now() + token.expires_in * 1000,
  });
  return token.access_token;
}

async function fetchCollection<T>(
  accessToken: string,
  path: string,
  startMs: number,
  endMs: number,
): Promise<T[]> {
  const records: T[] = [];
  let nextToken: string | undefined;
  do {
    const params = new URLSearchParams({
      limit: "25",
      start: new Date(startMs).toISOString(),
      end: new Date(endMs).toISOString(),
    });
    if (nextToken) params.set("nextToken", nextToken);
    const res = await fetch(`${API_BASE}${path}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(
        `WHOOP ${path} failed (${res.status}): ${text.slice(0, 200)}`,
      );
    }
    const data = (await res.json()) as {
      records?: T[];
      next_token?: string | null;
    };
    records.push(...(data.records ?? []));
    nextToken = data.next_token ?? undefined;
    // Safety valve so a bad pagination token can't loop forever.
  } while (nextToken && records.length < 2000);
  return records;
}

// ---------------------------------------------------------------------------
// WHOOP response shapes (only the fields we keep)
// ---------------------------------------------------------------------------

type WhoopSleep = {
  id: string;
  start: string;
  end: string;
  nap: boolean;
  score_state: string;
  score?: {
    stage_summary?: {
      total_in_bed_time_milli?: number;
      total_awake_time_milli?: number;
      total_light_sleep_time_milli?: number;
      total_slow_wave_sleep_time_milli?: number;
      total_rem_sleep_time_milli?: number;
      sleep_cycle_count?: number;
      disturbance_count?: number;
    };
    respiratory_rate?: number;
    sleep_performance_percentage?: number;
    sleep_consistency_percentage?: number;
    sleep_efficiency_percentage?: number;
  } | null;
};

type WhoopWorkout = {
  id: string;
  sport_name?: string;
  start: string;
  end: string;
  score_state: string;
  score?: {
    strain?: number;
    average_heart_rate?: number;
    max_heart_rate?: number;
    kilojoule?: number;
    distance_meter?: number | null;
  } | null;
};

type WhoopCycle = {
  id: number;
  start: string;
  end?: string | null;
  score_state: string;
  score?: {
    strain?: number;
    kilojoule?: number;
    average_heart_rate?: number;
    max_heart_rate?: number;
  } | null;
};

type WhoopRecovery = {
  cycle_id: number;
  sleep_id: string;
  created_at: string;
  score_state: string;
  score?: {
    user_calibrating?: boolean;
    recovery_score?: number;
    resting_heart_rate?: number;
    hrv_rmssd_milli?: number;
    spo2_percentage?: number;
    skin_temp_celsius?: number;
  } | null;
};

function mapSleep(s: WhoopSleep) {
  const stages = s.score?.stage_summary;
  return {
    whoopId: s.id,
    start: Date.parse(s.start),
    end: Date.parse(s.end),
    nap: s.nap,
    scoreState: s.score_state,
    performancePct: s.score?.sleep_performance_percentage ?? undefined,
    efficiencyPct: s.score?.sleep_efficiency_percentage ?? undefined,
    consistencyPct: s.score?.sleep_consistency_percentage ?? undefined,
    respiratoryRate: s.score?.respiratory_rate ?? undefined,
    inBedMilli: stages?.total_in_bed_time_milli ?? undefined,
    awakeMilli: stages?.total_awake_time_milli ?? undefined,
    lightMilli: stages?.total_light_sleep_time_milli ?? undefined,
    swsMilli: stages?.total_slow_wave_sleep_time_milli ?? undefined,
    remMilli: stages?.total_rem_sleep_time_milli ?? undefined,
    sleepCycleCount: stages?.sleep_cycle_count ?? undefined,
    disturbanceCount: stages?.disturbance_count ?? undefined,
  };
}

function mapWorkout(w: WhoopWorkout) {
  return {
    whoopId: w.id,
    sportName: w.sport_name ?? "Activity",
    start: Date.parse(w.start),
    end: Date.parse(w.end),
    scoreState: w.score_state,
    strain: w.score?.strain ?? undefined,
    avgHeartRate: w.score?.average_heart_rate ?? undefined,
    maxHeartRate: w.score?.max_heart_rate ?? undefined,
    kilojoule: w.score?.kilojoule ?? undefined,
    distanceMeter: w.score?.distance_meter ?? undefined,
  };
}

function mapCycle(c: WhoopCycle) {
  return {
    whoopId: c.id,
    start: Date.parse(c.start),
    end: c.end ? Date.parse(c.end) : undefined,
    scoreState: c.score_state,
    strain: c.score?.strain ?? undefined,
    kilojoule: c.score?.kilojoule ?? undefined,
    avgHeartRate: c.score?.average_heart_rate ?? undefined,
    maxHeartRate: c.score?.max_heart_rate ?? undefined,
  };
}

function mapRecovery(r: WhoopRecovery) {
  return {
    cycleId: r.cycle_id,
    sleepId: r.sleep_id,
    scoreState: r.score_state,
    userCalibrating: r.score?.user_calibrating ?? undefined,
    recoveryScore: r.score?.recovery_score ?? undefined,
    restingHeartRate: r.score?.resting_heart_rate ?? undefined,
    hrvRmssdMilli: r.score?.hrv_rmssd_milli ?? undefined,
    spo2Percentage: r.score?.spo2_percentage ?? undefined,
    skinTempCelsius: r.score?.skin_temp_celsius ?? undefined,
    recordedAt: Date.parse(r.created_at),
  };
}

// ---------------------------------------------------------------------------
// Sync
// ---------------------------------------------------------------------------

async function performSync(ctx: ActionCtx, account: Doc<"whoopAccounts">) {
  const now = Date.now();
  const start = account.lastSyncedAt
    ? account.lastSyncedAt - RESYNC_OVERLAP_MS
    : now - INITIAL_SYNC_WINDOW_MS;
  const userId = account.userId;

  try {
    const accessToken = await freshAccessToken(ctx, account);

    const [sleeps, workouts, cycles, recoveries] = await Promise.all([
      fetchCollection<WhoopSleep>(accessToken, "/v2/activity/sleep", start, now),
      fetchCollection<WhoopWorkout>(
        accessToken,
        "/v2/activity/workout",
        start,
        now,
      ),
      fetchCollection<WhoopCycle>(accessToken, "/v2/cycle", start, now),
      fetchCollection<WhoopRecovery>(accessToken, "/v2/recovery", start, now),
    ]);

    await ctx.runMutation(internal.whoop.upsertSleeps, {
      userId,
      records: sleeps.map(mapSleep),
    });
    await ctx.runMutation(internal.whoop.upsertWorkouts, {
      userId,
      records: workouts.map(mapWorkout),
    });
    await ctx.runMutation(internal.whoop.upsertCycles, {
      userId,
      records: cycles.map(mapCycle),
    });
    await ctx.runMutation(internal.whoop.upsertRecoveries, {
      userId,
      records: recoveries.map(mapRecovery),
    });

    await ctx.runMutation(internal.whoop.markSyncResult, {
      accountId: account._id,
      lastSyncedAt: now,
    });
  } catch (err) {
    await ctx.runMutation(internal.whoop.markSyncResult, {
      accountId: account._id,
      syncError: String(err).slice(0, 300),
    });
    throw err;
  }
}

export const syncAccount = internalAction({
  args: { accountId: v.id("whoopAccounts") },
  handler: async (ctx, { accountId }) => {
    const account = await ctx.runQuery(internal.whoop.getAccount, {
      accountId,
    });
    if (!account) return;
    await performSync(ctx, account);
  },
});

// Run by the daily cron. Accounts sync sequentially so refresh-token rotation
// never races.
export const syncAll = internalAction({
  args: {},
  handler: async (ctx) => {
    const accounts = await ctx.runQuery(internal.whoop.listAccounts, {});
    for (const account of accounts) {
      try {
        await performSync(ctx, account);
      } catch (err) {
        console.error(`WHOOP sync failed for account ${account._id}:`, err);
      }
    }
  },
});

export const syncNow = action({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const account = await ctx.runQuery(internal.whoop.accountForUser, {
      userId,
    });
    if (!account) throw new Error("WHOOP is not connected");
    await performSync(ctx, account);
  },
});

export const disconnect = action({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const account = await ctx.runQuery(internal.whoop.accountForUser, {
      userId,
    });
    if (!account) return;
    // Best-effort token revocation; the account row is removed regardless.
    // Synced history is kept.
    try {
      await fetch(`${API_BASE}/v2/user/access`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${account.accessToken}` },
      });
    } catch {
      // ignore
    }
    await ctx.runMutation(internal.whoop.deleteAccount, {
      accountId: account._id,
    });
  },
});

// ---------------------------------------------------------------------------
// Upserts (keyed by the WHOOP record id so re-syncs update in place)
// ---------------------------------------------------------------------------

export const upsertSleeps = internalMutation({
  args: {
    userId: v.id("users"),
    records: v.array(
      v.object({
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
      }),
    ),
  },
  handler: async (ctx, { userId, records }) => {
    for (const record of records) {
      const existing = await ctx.db
        .query("whoopSleep")
        .withIndex("by_user_whoop", (q) =>
          q.eq("userId", userId).eq("whoopId", record.whoopId),
        )
        .unique();
      if (existing) await ctx.db.replace(existing._id, { userId, ...record });
      else await ctx.db.insert("whoopSleep", { userId, ...record });
    }
  },
});

export const upsertWorkouts = internalMutation({
  args: {
    userId: v.id("users"),
    records: v.array(
      v.object({
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
      }),
    ),
  },
  handler: async (ctx, { userId, records }) => {
    for (const record of records) {
      const existing = await ctx.db
        .query("whoopWorkouts")
        .withIndex("by_user_whoop", (q) =>
          q.eq("userId", userId).eq("whoopId", record.whoopId),
        )
        .unique();
      if (existing) await ctx.db.replace(existing._id, { userId, ...record });
      else await ctx.db.insert("whoopWorkouts", { userId, ...record });
    }
  },
});

export const upsertCycles = internalMutation({
  args: {
    userId: v.id("users"),
    records: v.array(
      v.object({
        whoopId: v.number(),
        start: v.number(),
        end: v.optional(v.number()),
        scoreState: v.string(),
        strain: v.optional(v.number()),
        kilojoule: v.optional(v.number()),
        avgHeartRate: v.optional(v.number()),
        maxHeartRate: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, { userId, records }) => {
    for (const record of records) {
      const existing = await ctx.db
        .query("whoopCycles")
        .withIndex("by_user_whoop", (q) =>
          q.eq("userId", userId).eq("whoopId", record.whoopId),
        )
        .unique();
      if (existing) await ctx.db.replace(existing._id, { userId, ...record });
      else await ctx.db.insert("whoopCycles", { userId, ...record });
    }
  },
});

export const upsertRecoveries = internalMutation({
  args: {
    userId: v.id("users"),
    records: v.array(
      v.object({
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
      }),
    ),
  },
  handler: async (ctx, { userId, records }) => {
    for (const record of records) {
      const existing = await ctx.db
        .query("whoopRecovery")
        .withIndex("by_user_cycle", (q) =>
          q.eq("userId", userId).eq("cycleId", record.cycleId),
        )
        .unique();
      if (existing) await ctx.db.replace(existing._id, { userId, ...record });
      else await ctx.db.insert("whoopRecovery", { userId, ...record });
    }
  },
});

// ---------------------------------------------------------------------------
// Queries for the UI
// ---------------------------------------------------------------------------

export const connection = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const account = await ctx.db
      .query("whoopAccounts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (!account) return { connected: false as const };
    return {
      connected: true as const,
      lastSyncedAt: account.lastSyncedAt,
      syncError: account.syncError,
    };
  },
});

export const data = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const [sleep, workouts, cycles, recovery] = await Promise.all([
      ctx.db
        .query("whoopSleep")
        .withIndex("by_user_time", (q) => q.eq("userId", userId))
        .order("desc")
        .take(14),
      ctx.db
        .query("whoopWorkouts")
        .withIndex("by_user_time", (q) => q.eq("userId", userId))
        .order("desc")
        .take(20),
      ctx.db
        .query("whoopCycles")
        .withIndex("by_user_time", (q) => q.eq("userId", userId))
        .order("desc")
        .take(14),
      ctx.db
        .query("whoopRecovery")
        .withIndex("by_user_time", (q) => q.eq("userId", userId))
        .order("desc")
        .take(14),
    ]);
    return { sleep, workouts, cycles, recovery };
  },
});
