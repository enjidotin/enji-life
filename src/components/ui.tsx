import { ReactNode } from "react";

export function PageHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-5 sm:mb-6">
      <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
        {title}
      </h1>
      {description && (
        <p className="mt-1 text-sm text-neutral-500">{description}</p>
      )}
    </div>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5 dark:border-neutral-800 dark:bg-neutral-900 ${className}`}
    >
      {children}
    </div>
  );
}

// Inputs are 16px on mobile (forced via globals.css) to avoid iOS zoom,
// and 14px on sm+ for density.
export const inputClass =
  "rounded-md border border-neutral-300 bg-transparent px-3 py-2.5 text-sm focus:border-neutral-900 focus:outline-none sm:py-2 dark:border-neutral-700 dark:focus:border-neutral-100";

export const primaryButtonClass =
  "rounded-md bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 active:bg-neutral-700 disabled:opacity-60 sm:py-2 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200";

// Touch target is at least 44px tall on mobile; smaller on desktop.
export const dangerButtonClass =
  "self-start rounded-md border border-neutral-200 px-3 py-2 text-xs text-neutral-500 hover:border-red-300 hover:bg-red-50 hover:text-red-600 active:bg-red-100 sm:px-2 sm:py-1 dark:border-neutral-800 dark:text-neutral-400 dark:hover:border-red-700 dark:hover:bg-red-900/30";

export function formatDate(ms: number) {
  return new Date(ms).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
