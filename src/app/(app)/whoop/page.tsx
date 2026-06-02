"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "../../../../convex/_generated/api";
import {
  Card,
  PageHeader,
  dangerButtonClass,
  pillClass,
  primaryButtonClass,
  timeAgo,
} from "@/components/ui";

function fmtDuration(ms?: number) {
  if (!ms || ms <= 0) return "–";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.round((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m`;
}

function fmtDay(ms: number) {
  return new Date(ms).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function kcal(kilojoule?: number) {
  return kilojoule != null ? Math.round(kilojoule / 4.184) : undefined;
}

// WHOOP convention: green ≥ 67, yellow 34–66, red < 34.
function recoveryColor(score?: number) {
  if (score == null) return "text-neutral-400";
  if (score >= 67) return "text-emerald-600 dark:text-emerald-500";
  if (score >= 34) return "text-amber-500";
  return "text-red-500";
}

// Time actually asleep (in bed minus awake), falling back to the raw window.
function sleepDuration(s: {
  start: number;
  end: number;
  inBedMilli?: number;
  awakeMilli?: number;
}) {
  if (s.inBedMilli != null) return s.inBedMilli - (s.awakeMilli ?? 0);
  return s.end - s.start;
}

export default function WhoopPage() {
  const connection = useQuery(api.whoop.connection);
  const data = useQuery(api.whoop.data);
  const startAuthorization = useMutation(api.whoop.startAuthorization);
  const syncNow = useAction(api.whoop.syncNow);
  const disconnect = useAction(api.whoop.disconnect);

  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Surface ?error= / ?connected=1 from the OAuth redirect.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    if (error) setNotice(`WHOOP connection failed: ${error}`);
    else if (params.get("connected"))
      setNotice("WHOOP connected. Pulling your last 30 days in the background…");
    if (error || params.get("connected")) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  async function onConnect() {
    setBusy(true);
    try {
      const url = await startAuthorization({});
      window.location.href = url;
    } catch (err) {
      setNotice(String(err instanceof Error ? err.message : err));
      setBusy(false);
    }
  }

  async function onSync() {
    setBusy(true);
    setNotice(null);
    try {
      await syncNow({});
      setNotice("Sync complete.");
    } catch (err) {
      setNotice(String(err instanceof Error ? err.message : err));
    } finally {
      setBusy(false);
    }
  }

  async function onDisconnect() {
    if (!window.confirm("Disconnect WHOOP? Synced history is kept.")) return;
    setBusy(true);
    try {
      await disconnect({});
      setNotice(null);
    } finally {
      setBusy(false);
    }
  }

  const latestRecovery = data?.recovery?.[0];
  const latestSleep = data?.sleep?.find((s) => !s.nap) ?? data?.sleep?.[0];
  const latestCycle = data?.cycles?.[0];

  return (
    <div>
      <PageHeader
        title="Whoop"
        description="Sleep, recovery and strain from your WHOOP, synced daily."
      />

      {notice && (
        <div className="mb-4 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
          {notice}
        </div>
      )}

      {connection === undefined ? (
        <p className="text-sm text-neutral-400">Loading…</p>
      ) : !connection?.connected ? (
        <Card>
          <h2 className="text-base font-medium">Connect your WHOOP</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Authorize access to your sleep, recovery, workouts and daily strain.
            Data syncs automatically every day, and you can trigger a sync
            manually any time.
          </p>
          <button
            onClick={onConnect}
            disabled={busy}
            className={`${primaryButtonClass} mt-4`}
          >
            {busy ? "Redirecting…" : "Connect WHOOP"}
          </button>
        </Card>
      ) : (
        <>
          <Card className="mb-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className={pillClass}>Connected</span>
              <span className="text-sm text-neutral-500">
                {connection.lastSyncedAt
                  ? `Last synced ${timeAgo(connection.lastSyncedAt)}`
                  : "First sync in progress…"}
              </span>
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={onSync}
                  disabled={busy}
                  className={primaryButtonClass}
                >
                  {busy ? "Syncing…" : "Sync now"}
                </button>
                <button onClick={onDisconnect} className={dangerButtonClass}>
                  Disconnect
                </button>
              </div>
            </div>
            {connection.syncError && (
              <p className="mt-2 text-xs text-red-500">
                Last sync failed: {connection.syncError}
              </p>
            )}
          </Card>

          <div className="mb-6 grid grid-cols-3 gap-2 sm:gap-4">
            <Card>
              <div className="text-sm text-neutral-500">Recovery</div>
              <div
                className={`mt-1 text-2xl font-semibold ${recoveryColor(latestRecovery?.recoveryScore)}`}
              >
                {latestRecovery?.recoveryScore != null
                  ? `${Math.round(latestRecovery.recoveryScore)}%`
                  : "–"}
              </div>
              <div className="mt-1 text-xs text-neutral-500">
                {latestRecovery?.restingHeartRate != null &&
                  `RHR ${Math.round(latestRecovery.restingHeartRate)} · `}
                {latestRecovery?.hrvRmssdMilli != null &&
                  `HRV ${Math.round(latestRecovery.hrvRmssdMilli)}`}
              </div>
            </Card>
            <Card>
              <div className="text-sm text-neutral-500">Sleep</div>
              <div className="mt-1 text-2xl font-semibold">
                {latestSleep ? fmtDuration(sleepDuration(latestSleep)) : "–"}
              </div>
              <div className="mt-1 text-xs text-neutral-500">
                {latestSleep?.performancePct != null &&
                  `${Math.round(latestSleep.performancePct)}% performance`}
              </div>
            </Card>
            <Card>
              <div className="text-sm text-neutral-500">Day strain</div>
              <div className="mt-1 text-2xl font-semibold">
                {latestCycle?.strain != null
                  ? latestCycle.strain.toFixed(1)
                  : "–"}
              </div>
              <div className="mt-1 text-xs text-neutral-500">
                {kcal(latestCycle?.kilojoule) != null &&
                  `${kcal(latestCycle?.kilojoule)} kcal`}
              </div>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <h2 className="mb-3 text-base font-medium">Recent sleep</h2>
              {data === undefined ? (
                <p className="text-sm text-neutral-400">Loading…</p>
              ) : !data?.sleep.length ? (
                <p className="text-sm text-neutral-400">
                  No sleep data yet. It will appear after the first sync.
                </p>
              ) : (
                <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {data.sleep.map((s) => (
                    <li
                      key={s._id}
                      className="flex items-center justify-between gap-3 py-2.5 text-sm"
                    >
                      <div>
                        <div className="font-medium">
                          {fmtDuration(sleepDuration(s))}
                          {s.nap && (
                            <span className={`${pillClass} ml-2`}>Nap</span>
                          )}
                        </div>
                        <div className="mt-0.5 text-xs text-neutral-500">
                          {fmtDay(s.end)}
                          {s.remMilli != null &&
                            ` · REM ${fmtDuration(s.remMilli)}`}
                          {s.swsMilli != null &&
                            ` · Deep ${fmtDuration(s.swsMilli)}`}
                        </div>
                      </div>
                      <div className="text-right text-neutral-500">
                        {s.performancePct != null
                          ? `${Math.round(s.performancePct)}%`
                          : "–"}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <h2 className="mb-3 text-base font-medium">Recent activities</h2>
              {data === undefined ? (
                <p className="text-sm text-neutral-400">Loading…</p>
              ) : !data?.workouts.length ? (
                <p className="text-sm text-neutral-400">
                  No activities yet. It will appear after the first sync.
                </p>
              ) : (
                <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {data.workouts.map((w) => (
                    <li
                      key={w._id}
                      className="flex items-center justify-between gap-3 py-2.5 text-sm"
                    >
                      <div>
                        <div className="font-medium">{w.sportName}</div>
                        <div className="mt-0.5 text-xs text-neutral-500">
                          {fmtDay(w.start)} · {fmtDuration(w.end - w.start)}
                          {w.avgHeartRate != null &&
                            ` · ${Math.round(w.avgHeartRate)} bpm avg`}
                        </div>
                      </div>
                      <div className="text-right text-neutral-500">
                        {w.strain != null && (
                          <div className="font-medium text-neutral-900 dark:text-neutral-100">
                            {w.strain.toFixed(1)}
                          </div>
                        )}
                        {kcal(w.kilojoule) != null && (
                          <div className="text-xs">{kcal(w.kilojoule)} kcal</div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
