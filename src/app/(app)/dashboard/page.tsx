"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { api } from "../../../../convex/_generated/api";
import { Card, PageHeader, pillClass, timeAgo } from "@/components/ui";
import { mealTotals, roundTotal } from "@/lib/meals";
import {
  Utensils,
  Dumbbell,
  Scale,
  Camera,
  ChevronRight,
  Plus,
} from "lucide-react";

export default function DashboardPage() {
  const viewer = useQuery(api.users.viewer);
  const meals = useQuery(api.meals.list);
  const workouts = useQuery(api.workouts.list);
  const weights = useQuery(api.weight.list);
  const photos = useQuery(api.photos.list);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStart = today.getTime();

  const todaysMeals = meals?.filter((m) => m.consumedAt >= todayStart) ?? [];
  const todaysWorkouts =
    workouts?.filter((w) => w.performedAt >= todayStart) ?? [];
  const todayTotals = todaysMeals.reduce(
    (acc, m) => {
      const t = mealTotals(m.items);
      acc.calories += t.calories;
      acc.protein += t.protein;
      return acc;
    },
    { calories: 0, protein: 0 },
  );
  const latestWeight = weights?.[0];

  const quickActions = [
    { href: "/meals", label: "Meal", icon: Utensils },
    { href: "/workouts", label: "Workout", icon: Dumbbell },
    { href: "/weight", label: "Weight", icon: Scale },
  ];

  const stats = [
    {
      href: "/meals",
      label: "Meals today",
      value: String(todaysMeals.length),
      sub: todayTotals.calories
        ? `${roundTotal(todayTotals.calories)} kcal · P ${roundTotal(todayTotals.protein)}g`
        : "No calories logged",
      icon: Utensils,
    },
    {
      href: "/workouts",
      label: "Workouts today",
      value: String(todaysWorkouts.length),
      sub: todaysWorkouts.length ? "Nice work" : "None yet",
      icon: Dumbbell,
    },
    {
      href: "/weight",
      label: "Latest weight",
      value: latestWeight ? `${latestWeight.weight} ${latestWeight.unit}` : "—",
      sub: latestWeight ? timeAgo(latestWeight.loggedAt) : "Not logged",
      icon: Scale,
    },
    {
      href: "/photos",
      label: "Progress photos",
      value: String(photos?.length ?? 0),
      sub: "View gallery",
      icon: Camera,
    },
  ];

  return (
    <div>
      <PageHeader
        title={`Hi${viewer?.email ? `, ${viewer.email.split("@")[0]}` : ""}`}
        description="Your logs for today."
      />

      {/* Quick log */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {quickActions.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-neutral-200 bg-white py-4 text-sm font-medium shadow-sm transition-colors hover:border-neutral-400 hover:bg-neutral-50 active:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-600 dark:hover:bg-neutral-800"
          >
            <span className="relative">
              <a.icon className="size-6" />
              <Plus className="absolute -right-2 -top-1.5 size-3.5 rounded-full bg-neutral-900 p-0.5 text-white dark:bg-neutral-100 dark:text-neutral-900" />
            </span>
            <span>{a.label}</span>
          </Link>
        ))}
      </div>

      {/* Today stats */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="group">
            <Card className="h-full transition-colors group-hover:border-neutral-400 group-active:bg-neutral-50 dark:group-hover:border-neutral-600 dark:group-active:bg-neutral-800/50">
              <div className="flex items-center justify-between text-neutral-500">
                <span className="text-xs sm:text-sm">{s.label}</span>
                <s.icon className="size-4 shrink-0 opacity-60" />
              </div>
              <div className="mt-1 text-2xl font-semibold">{s.value}</div>
              <div className="mt-1 truncate text-xs text-neutral-500">{s.sub}</div>
            </Card>
          </Link>
        ))}
      </div>

      {/* Recent */}
      <div className="mt-6 grid gap-4 sm:mt-8 lg:grid-cols-2">
        <Card>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-neutral-500">Recent meals</h2>
            <Link
              href="/meals"
              className="flex items-center text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
            >
              All <ChevronRight className="size-3.5" />
            </Link>
          </div>
          {meals === undefined ? (
            <p className="text-sm text-neutral-400">Loading…</p>
          ) : meals.length === 0 ? (
            <p className="text-sm text-neutral-400">Nothing logged yet.</p>
          ) : (
            <ul className="divide-y divide-neutral-100 text-sm dark:divide-neutral-800">
              {meals.slice(0, 5).map((m) => {
                const kcal = roundTotal(mealTotals(m.items).calories);
                return (
                  <li key={m._id} className="flex items-center gap-3 py-2.5">
                    <span className="min-w-0 flex-1 truncate">
                      {m.items.map((it) => it.name).join(" + ") || "Meal"}
                    </span>
                    {kcal > 0 && <span className={pillClass}>{kcal} kcal</span>}
                    <span className="shrink-0 text-xs text-neutral-400">
                      {timeAgo(m.consumedAt)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        <Card>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-neutral-500">
              Recent workouts
            </h2>
            <Link
              href="/workouts"
              className="flex items-center text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
            >
              All <ChevronRight className="size-3.5" />
            </Link>
          </div>
          {workouts === undefined ? (
            <p className="text-sm text-neutral-400">Loading…</p>
          ) : workouts.length === 0 ? (
            <p className="text-sm text-neutral-400">Nothing logged yet.</p>
          ) : (
            <ul className="divide-y divide-neutral-100 text-sm dark:divide-neutral-800">
              {workouts.slice(0, 5).map((w) => (
                <li key={w._id} className="flex items-center gap-3 py-2.5">
                  <span className="min-w-0 flex-1 truncate">
                    {w.items.map((it) => it.name).join(" + ") || "Workout"}
                  </span>
                  <span className={pillClass}>
                    {w.items.length} ex{w.items.length === 1 ? "" : "s"}
                  </span>
                  <span className="shrink-0 text-xs text-neutral-400">
                    {timeAgo(w.performedAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
