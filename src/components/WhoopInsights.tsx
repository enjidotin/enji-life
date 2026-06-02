import { Doc } from "../../convex/_generated/dataModel";
import { Card } from "@/components/ui";

type SleepDoc = Doc<"whoopSleep">;
type CycleDoc = Doc<"whoopCycles">;
type RecoveryDoc = Doc<"whoopRecovery">;

const HOUR_MS = 3_600_000;

export function fmtDuration(ms?: number) {
  if (!ms || ms <= 0) return "–";
  const h = Math.floor(ms / HOUR_MS);
  const m = Math.round((ms % HOUR_MS) / 60_000);
  return `${h}h ${m}m`;
}

// Time actually asleep (in bed minus awake), falling back to the raw window.
export function sleepDuration(s: {
  start: number;
  end: number;
  inBedMilli?: number;
  awakeMilli?: number;
}) {
  if (s.inBedMilli != null) return s.inBedMilli - (s.awakeMilli ?? 0);
  return s.end - s.start;
}

function dateLabel(ms: number) {
  return new Date(ms).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function avg(xs: number[]): number | undefined {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined;
}

function defined(xs: Array<number | undefined>): number[] {
  return xs.filter((x): x is number => x != null);
}

// ---------------------------------------------------------------------------
// One row per calendar day, last 30 days, oldest → newest
// ---------------------------------------------------------------------------

type DayDatum = {
  day: number;
  recovery?: number;
  hrv?: number;
  rhr?: number;
  strain?: number;
  sleepMs?: number;
  deepMs?: number;
  remMs?: number;
  lightMs?: number;
};

function dayStart(ms: number) {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function buildDays(
  sleep: SleepDoc[],
  cycles: CycleDoc[],
  recovery: RecoveryDoc[],
  n = 30,
): DayDatum[] {
  const now = new Date();
  const map = new Map<number, DayDatum>();
  for (let i = n - 1; i >= 0; i--) {
    const day = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - i,
    ).getTime();
    map.set(day, { day });
  }
  for (const r of recovery) {
    const d = map.get(dayStart(r.recordedAt));
    if (!d) continue;
    if (r.recoveryScore != null) d.recovery = r.recoveryScore;
    if (r.hrvRmssdMilli != null) d.hrv = r.hrvRmssdMilli;
    if (r.restingHeartRate != null) d.rhr = r.restingHeartRate;
  }
  for (const c of cycles) {
    const d = map.get(dayStart(c.start));
    if (d && c.strain != null) d.strain = c.strain;
  }
  for (const s of sleep) {
    if (s.nap) continue;
    const d = map.get(dayStart(s.end));
    if (!d || d.sleepMs != null) continue; // keep the night, not later re-sleeps
    d.sleepMs = sleepDuration(s);
    d.deepMs = s.swsMilli;
    d.remMs = s.remMilli;
    d.lightMs = s.lightMilli;
  }
  return [...map.values()];
}

// ---------------------------------------------------------------------------
// Insights
// ---------------------------------------------------------------------------

type Insight = {
  value: string;
  label: string;
  delta?: string;
  tone: "good" | "bad" | "neutral";
};

function computeInsights(days: DayDatum[]): Insight[] {
  const last7 = days.slice(-7);
  const prev7 = days.slice(-14, -7);
  const insights: Insight[] = [];

  const recNow = avg(defined(last7.map((d) => d.recovery)));
  const recPrev = avg(defined(prev7.map((d) => d.recovery)));
  if (recNow != null) {
    const diff = recPrev != null ? Math.round(recNow - recPrev) : undefined;
    insights.push({
      value: `${Math.round(recNow)}%`,
      label: "avg recovery · 7 days",
      delta:
        diff != null
          ? `${diff >= 0 ? "▲" : "▼"} ${Math.abs(diff)} pts vs prior week`
          : undefined,
      tone: diff == null ? "neutral" : diff >= 0 ? "good" : "bad",
    });
  }

  const sleepNow = avg(defined(last7.map((d) => d.sleepMs)));
  const sleepPrev = avg(defined(prev7.map((d) => d.sleepMs)));
  if (sleepNow != null) {
    const diffMin =
      sleepPrev != null ? Math.round((sleepNow - sleepPrev) / 60_000) : undefined;
    insights.push({
      value: fmtDuration(sleepNow),
      label: "avg sleep · 7 nights",
      delta:
        diffMin != null
          ? `${diffMin >= 0 ? "▲" : "▼"} ${Math.abs(diffMin)}m vs prior week`
          : undefined,
      tone: diffMin == null ? "neutral" : diffMin >= 0 ? "good" : "bad",
    });
  }

  const hrvNow = avg(defined(last7.map((d) => d.hrv)));
  const hrvBase = avg(defined(days.map((d) => d.hrv)));
  if (hrvNow != null) {
    const pct =
      hrvBase != null && hrvBase > 0
        ? Math.round(((hrvNow - hrvBase) / hrvBase) * 100)
        : undefined;
    insights.push({
      value: `${Math.round(hrvNow)} ms`,
      label: "avg HRV · 7 days",
      delta:
        pct != null
          ? `${pct >= 0 ? "▲" : "▼"} ${Math.abs(pct)}% vs 30-day baseline`
          : undefined,
      tone: pct == null ? "neutral" : pct >= 0 ? "good" : "bad",
    });
  }

  // Does sleeping 7h+ actually pay off in recovery?
  const pairs = days.filter((d) => d.sleepMs != null && d.recovery != null);
  const long = pairs.filter((d) => d.sleepMs! >= 7 * HOUR_MS);
  const short = pairs.filter((d) => d.sleepMs! < 7 * HOUR_MS);
  if (long.length >= 3 && short.length >= 3) {
    const diff = Math.round(
      avg(long.map((d) => d.recovery!))! - avg(short.map((d) => d.recovery!))!,
    );
    insights.push({
      value: `${diff >= 0 ? "+" : ""}${diff} pts`,
      label: "recovery on 7h+ nights",
      delta: `vs nights under 7h (${long.length}/${short.length} nights)`,
      tone: diff >= 0 ? "good" : "bad",
    });
  }

  return insights;
}

// ---------------------------------------------------------------------------
// SVG chart primitives — hairline grids, data-colored marks
// ---------------------------------------------------------------------------

const W = 600;
const GRID = "stroke-neutral-200 dark:stroke-neutral-800";
const TICK = "fill-neutral-400 text-[9px]";

function recoveryFill(score: number) {
  if (score >= 67) return "fill-emerald-500";
  if (score >= 34) return "fill-amber-400";
  return "fill-red-500";
}

function XDateLabels({
  days,
  xc,
  yPos,
}: {
  days: DayDatum[];
  xc: (i: number) => number;
  yPos: number;
}) {
  const idxs = [0, Math.floor(days.length / 2), days.length - 1];
  return (
    <>
      {idxs.map((i, k) => (
        <text
          key={i}
          x={xc(i)}
          y={yPos}
          textAnchor={k === 0 ? "start" : k === 2 ? "end" : "middle"}
          className={TICK}
        >
          {dateLabel(days[i].day)}
        </text>
      ))}
    </>
  );
}

// Builds a line path that lifts the pen over missing days.
function linePath(
  days: DayDatum[],
  get: (d: DayDatum) => number | undefined,
  xc: (i: number) => number,
  y: (v: number) => number,
) {
  let path = "";
  let pen = false;
  days.forEach((d, i) => {
    const v = get(d);
    if (v == null) {
      pen = false;
      return;
    }
    path += `${pen ? "L" : "M"}${xc(i).toFixed(1)},${y(v).toFixed(1)}`;
    pen = true;
  });
  return path;
}

function RecoveryChart({ days }: { days: DayDatum[] }) {
  const H = 150;
  const T = 8, B = 18, L = 28, R = 4;
  const pw = W - L - R, ph = H - T - B;
  const xc = (i: number) => L + (pw * (i + 0.5)) / days.length;
  const y = (v: number) => T + ph * (1 - v / 100);
  const bw = Math.min(11, (pw / days.length) * 0.62);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {[0, 33, 67, 100].map((g) => (
        <g key={g}>
          <line
            x1={L}
            x2={W - R}
            y1={y(g)}
            y2={y(g)}
            className={GRID}
            strokeWidth="1"
            strokeDasharray={g === 0 ? undefined : "2 4"}
          />
          <text x={L - 5} y={y(g) + 3} textAnchor="end" className={TICK}>
            {g}
          </text>
        </g>
      ))}
      {days.map((d, i) =>
        d.recovery == null ? null : (
          <g key={d.day}>
            <title>{`${dateLabel(d.day)} — ${Math.round(d.recovery)}% recovery`}</title>
            <rect
              x={xc(i) - bw / 2}
              y={y(d.recovery)}
              width={bw}
              height={Math.max(2, y(0) - y(d.recovery))}
              rx={2}
              className={`${recoveryFill(d.recovery)} transition-opacity hover:opacity-70`}
            />
          </g>
        ),
      )}
      <XDateLabels days={days} xc={xc} yPos={H - 5} />
    </svg>
  );
}

function SleepChart({ days }: { days: DayDatum[] }) {
  const H = 150;
  const T = 8, B = 18, L = 28, R = 4;
  const pw = W - L - R, ph = H - T - B;
  const xc = (i: number) => L + (pw * (i + 0.5)) / days.length;
  const maxMs = Math.max(9 * HOUR_MS, ...days.map((d) => d.sleepMs ?? 0));
  const y = (v: number) => T + ph * (1 - v / maxMs);
  const bw = Math.min(11, (pw / days.length) * 0.62);
  const hourTicks = [0, 4, 8].filter((h) => h * HOUR_MS <= maxMs);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {hourTicks.map((h) => (
        <g key={h}>
          <line
            x1={L}
            x2={W - R}
            y1={y(h * HOUR_MS)}
            y2={y(h * HOUR_MS)}
            className={GRID}
            strokeWidth="1"
            strokeDasharray={h === 0 ? undefined : "2 4"}
          />
          <text
            x={L - 5}
            y={y(h * HOUR_MS) + 3}
            textAnchor="end"
            className={TICK}
          >
            {h}h
          </text>
        </g>
      ))}
      {days.map((d, i) => {
        if (d.sleepMs == null) return null;
        const hasStages =
          d.deepMs != null || d.remMs != null || d.lightMs != null;
        const segments = hasStages
          ? [
              { v: d.deepMs ?? 0, cls: "fill-indigo-600 dark:fill-indigo-500" },
              { v: d.remMs ?? 0, cls: "fill-sky-400" },
              { v: d.lightMs ?? 0, cls: "fill-neutral-300 dark:fill-neutral-600" },
            ]
          : [{ v: d.sleepMs, cls: "fill-neutral-300 dark:fill-neutral-600" }];
        let cum = 0;
        return (
          <g key={d.day} className="transition-opacity hover:opacity-70">
            <title>{`${dateLabel(d.day)} — ${fmtDuration(d.sleepMs)} asleep${
              d.deepMs != null ? ` · deep ${fmtDuration(d.deepMs)}` : ""
            }${d.remMs != null ? ` · REM ${fmtDuration(d.remMs)}` : ""}`}</title>
            {segments.map((seg, k) => {
              const y1 = y(cum + seg.v);
              const h = y(cum) - y1;
              cum += seg.v;
              return h <= 0 ? null : (
                <rect
                  key={k}
                  x={xc(i) - bw / 2}
                  y={y1}
                  width={bw}
                  height={h}
                  className={seg.cls}
                />
              );
            })}
          </g>
        );
      })}
      <XDateLabels days={days} xc={xc} yPos={H - 5} />
    </svg>
  );
}

function StrainRecoveryChart({ days }: { days: DayDatum[] }) {
  const H = 150;
  const T = 8, B = 18, L = 28, R = 26;
  const pw = W - L - R, ph = H - T - B;
  const xc = (i: number) => L + (pw * (i + 0.5)) / days.length;
  const yRec = (v: number) => T + ph * (1 - v / 100);
  const yStrain = (v: number) => T + ph * (1 - v / 21);
  const bw = Math.min(11, (pw / days.length) * 0.62);
  const path = linePath(days, (d) => d.strain, xc, yStrain);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {[0, 50, 100].map((g) => (
        <g key={g}>
          <line
            x1={L}
            x2={W - R}
            y1={yRec(g)}
            y2={yRec(g)}
            className={GRID}
            strokeWidth="1"
            strokeDasharray={g === 0 ? undefined : "2 4"}
          />
          <text x={L - 5} y={yRec(g) + 3} textAnchor="end" className={TICK}>
            {g}
          </text>
        </g>
      ))}
      {[0, 21].map((g) => (
        <text
          key={g}
          x={W - R + 5}
          y={yStrain(g) + 3}
          textAnchor="start"
          className={TICK}
        >
          {g}
        </text>
      ))}
      {days.map((d, i) =>
        d.recovery == null ? null : (
          <g key={d.day}>
            <title>{`${dateLabel(d.day)} — recovery ${Math.round(d.recovery)}%${
              d.strain != null ? ` · strain ${d.strain.toFixed(1)}` : ""
            }`}</title>
            <rect
              x={xc(i) - bw / 2}
              y={yRec(d.recovery)}
              width={bw}
              height={Math.max(2, yRec(0) - yRec(d.recovery))}
              rx={2}
              className={`${recoveryFill(d.recovery)} opacity-30`}
            />
          </g>
        ),
      )}
      <path
        d={path}
        fill="none"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-neutral-900 dark:stroke-neutral-100"
      />
      {days.map((d, i) =>
        d.strain == null ? null : (
          <circle
            key={d.day}
            cx={xc(i)}
            cy={yStrain(d.strain)}
            r={2}
            className="fill-neutral-900 dark:fill-neutral-100"
          />
        ),
      )}
      <XDateLabels days={days} xc={xc} yPos={H - 5} />
    </svg>
  );
}

function Sparkline({
  days,
  get,
  strokeClass,
  unit,
}: {
  days: DayDatum[];
  get: (d: DayDatum) => number | undefined;
  strokeClass: string;
  unit: string;
}) {
  const H = 64;
  const T = 8, B = 8, L = 8, R = 46;
  const pw = W - L - R, ph = H - T - B;
  const values = defined(days.map(get));
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = Math.max((max - min) * 0.15, 1);
  const lo = min - pad, hi = max + pad;
  const xc = (i: number) => L + (pw * (i + 0.5)) / days.length;
  const y = (v: number) => T + ph * (1 - (v - lo) / (hi - lo));
  const mean = avg(values)!;
  const lastIdx = days.reduce((acc, d, i) => (get(d) != null ? i : acc), -1);
  const last = get(days[lastIdx])!;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      <line
        x1={L}
        x2={W - R}
        y1={y(mean)}
        y2={y(mean)}
        className={GRID}
        strokeWidth="1"
        strokeDasharray="2 4"
      />
      <path
        d={linePath(days, get, xc, y)}
        fill="none"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={strokeClass}
      />
      <circle
        cx={xc(lastIdx)}
        cy={y(last)}
        r={2.5}
        className={strokeClass.replace(/stroke-/g, "fill-")}
      />
      <text
        x={W - R + 6}
        y={y(last) + 3}
        textAnchor="start"
        className="fill-neutral-900 text-[10px] font-medium dark:fill-neutral-100"
      >
        {Math.round(last)} {unit}
      </text>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Section
// ---------------------------------------------------------------------------

function ChartTitle({
  children,
  legend,
}: {
  children: React.ReactNode;
  legend?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="text-[11px] font-medium uppercase tracking-wider text-neutral-400">
        {children}
      </h2>
      {legend && (
        <div className="flex items-center gap-3 text-[10px] text-neutral-500">
          {legend}
        </div>
      )}
    </div>
  );
}

function Swatch({ className }: { className: string }) {
  return <span className={`inline-block size-2 rounded-[3px] ${className}`} />;
}

const toneClass = {
  good: "text-emerald-600 dark:text-emerald-500",
  bad: "text-red-500",
  neutral: "text-neutral-500",
} as const;

export function WhoopInsights({
  sleep,
  cycles,
  recovery,
}: {
  sleep: SleepDoc[];
  cycles: CycleDoc[];
  recovery: RecoveryDoc[];
}) {
  const days = buildDays(sleep, cycles, recovery);
  const withData = days.filter(
    (d) => d.recovery != null || d.sleepMs != null || d.strain != null,
  );
  if (withData.length < 2) return null;

  const insights = computeInsights(days);
  const hasRecovery = days.some((d) => d.recovery != null);
  const hasSleep = days.some((d) => d.sleepMs != null);
  const hasStrain = days.some((d) => d.strain != null);
  const hasHrv = defined(days.map((d) => d.hrv)).length >= 2;
  const hasRhr = defined(days.map((d) => d.rhr)).length >= 2;

  return (
    <div className="mb-6 space-y-6">
      {insights.length > 0 && (
        <Card>
          <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4">
            {insights.map((ins) => (
              <div key={ins.label}>
                <div className="text-xl font-semibold tabular-nums tracking-tight">
                  {ins.value}
                </div>
                <div className="mt-0.5 text-[11px] uppercase tracking-wider text-neutral-400">
                  {ins.label}
                </div>
                {ins.delta && (
                  <div className={`mt-1 text-[11px] ${toneClass[ins.tone]}`}>
                    {ins.delta}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {hasRecovery && (
          <Card>
            <ChartTitle
              legend={
                <>
                  <span className="flex items-center gap-1">
                    <Swatch className="bg-emerald-500" /> 67+
                  </span>
                  <span className="flex items-center gap-1">
                    <Swatch className="bg-amber-400" /> 34–66
                  </span>
                  <span className="flex items-center gap-1">
                    <Swatch className="bg-red-500" /> &lt;34
                  </span>
                </>
              }
            >
              Recovery · 30 days
            </ChartTitle>
            <RecoveryChart days={days} />
          </Card>
        )}

        {hasSleep && (
          <Card>
            <ChartTitle
              legend={
                <>
                  <span className="flex items-center gap-1">
                    <Swatch className="bg-indigo-600 dark:bg-indigo-500" /> Deep
                  </span>
                  <span className="flex items-center gap-1">
                    <Swatch className="bg-sky-400" /> REM
                  </span>
                  <span className="flex items-center gap-1">
                    <Swatch className="bg-neutral-300 dark:bg-neutral-600" />{" "}
                    Light
                  </span>
                </>
              }
            >
              Sleep stages · 30 nights
            </ChartTitle>
            <SleepChart days={days} />
          </Card>
        )}

        {hasStrain && hasRecovery && (
          <Card>
            <ChartTitle
              legend={
                <>
                  <span className="flex items-center gap-1">
                    <Swatch className="bg-emerald-500/40" /> Recovery
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-px w-4 bg-neutral-900 dark:bg-neutral-100" />{" "}
                    Strain
                  </span>
                </>
              }
            >
              Strain vs recovery
            </ChartTitle>
            <StrainRecoveryChart days={days} />
          </Card>
        )}

        {(hasHrv || hasRhr) && (
          <Card>
            <ChartTitle>Heart · 30 days</ChartTitle>
            <div className="space-y-3">
              {hasHrv && (
                <div>
                  <div className="mb-1 text-[10px] text-neutral-500">
                    HRV (rMSSD)
                  </div>
                  <Sparkline
                    days={days}
                    get={(d) => d.hrv}
                    strokeClass="stroke-sky-500"
                    unit="ms"
                  />
                </div>
              )}
              {hasRhr && (
                <div>
                  <div className="mb-1 text-[10px] text-neutral-500">
                    Resting heart rate
                  </div>
                  <Sparkline
                    days={days}
                    get={(d) => d.rhr}
                    strokeClass="stroke-neutral-900 dark:stroke-neutral-100"
                    unit="bpm"
                  />
                </div>
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
