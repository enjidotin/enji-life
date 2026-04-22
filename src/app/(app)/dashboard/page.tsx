"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Card, PageHeader, formatDate } from "@/components/ui";

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
  const caloriesToday = todaysMeals.reduce(
    (sum, m) => sum + (m.calories ?? 0),
    0,
  );
  const latestWeight = weights?.[0];

  return (
    <div>
      <PageHeader
        title={`Hi${viewer?.email ? `, ${viewer.email.split("@")[0]}` : ""}`}
        description="Your logs for today."
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Card>
          <div className="text-sm text-neutral-500">Meals today</div>
          <div className="mt-1 text-2xl font-semibold">
            {todaysMeals.length}
          </div>
          <div className="mt-1 text-xs text-neutral-500">
            {caloriesToday ? `${caloriesToday} kcal` : "No calories logged"}
          </div>
        </Card>
        <Card>
          <div className="text-sm text-neutral-500">Workouts today</div>
          <div className="mt-1 text-2xl font-semibold">
            {todaysWorkouts.length}
          </div>
        </Card>
        <Card>
          <div className="text-sm text-neutral-500">Latest weight</div>
          <div className="mt-1 text-2xl font-semibold">
            {latestWeight
              ? `${latestWeight.weight} ${latestWeight.unit}`
              : "—"}
          </div>
          {latestWeight && (
            <div className="mt-1 text-xs text-neutral-500">
              {formatDate(latestWeight.loggedAt)}
            </div>
          )}
        </Card>
        <Card>
          <div className="text-sm text-neutral-500">Progress photos</div>
          <div className="mt-1 text-2xl font-semibold">
            {photos?.length ?? 0}
          </div>
        </Card>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-neutral-500">
            Recent meals
          </h2>
          {meals === undefined ? (
            <p className="text-sm text-neutral-400">Loading…</p>
          ) : meals.length === 0 ? (
            <p className="text-sm text-neutral-400">Nothing logged yet.</p>
          ) : (
            <ul className="divide-y divide-neutral-100 text-sm dark:divide-neutral-800">
              {meals.slice(0, 5).map((m) => (
                <li
                  key={m._id}
                  className="flex items-center justify-between py-2"
                >
                  <span>{m.name}</span>
                  <span className="text-neutral-500">
                    {formatDate(m.consumedAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-neutral-500">
            Recent workouts
          </h2>
          {workouts === undefined ? (
            <p className="text-sm text-neutral-400">Loading…</p>
          ) : workouts.length === 0 ? (
            <p className="text-sm text-neutral-400">Nothing logged yet.</p>
          ) : (
            <ul className="divide-y divide-neutral-100 text-sm dark:divide-neutral-800">
              {workouts.slice(0, 5).map((w) => (
                <li
                  key={w._id}
                  className="flex items-center justify-between py-2"
                >
                  <span>{w.name}</span>
                  <span className="text-neutral-500">
                    {formatDate(w.performedAt)}
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
