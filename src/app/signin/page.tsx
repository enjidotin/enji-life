"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SignInPage() {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const [step, setStep] = useState<"signIn" | "signUp">("signIn");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <h1 className="mb-1 text-2xl font-semibold tracking-tight">
          Enji Life
        </h1>
        <p className="mb-6 text-sm text-neutral-500">
          {step === "signIn"
            ? "Sign in to log meals, workouts, weight, and photos."
            : "Create an account to start logging."}
        </p>

        <form
          className="flex flex-col gap-3"
          onSubmit={async (event) => {
            event.preventDefault();
            setError(null);
            setSubmitting(true);
            const formData = new FormData(event.currentTarget);
            try {
              await signIn("password", formData);
              router.push("/dashboard");
            } catch {
              setError(
                step === "signIn"
                  ? "Could not sign in. Check your email and password."
                  : "Could not sign up. The email may already be in use.",
              );
            } finally {
              setSubmitting(false);
            }
          }}
        >
          <input
            name="email"
            type="email"
            required
            placeholder="Email"
            className="rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none dark:border-neutral-700 dark:focus:border-neutral-100"
          />
          <input
            name="password"
            type="password"
            required
            minLength={8}
            placeholder="Password (min 8 chars)"
            className="rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none dark:border-neutral-700 dark:focus:border-neutral-100"
          />
          <input name="flow" type="hidden" value={step} />
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="mt-1 rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            {submitting
              ? "Please wait…"
              : step === "signIn"
                ? "Sign in"
                : "Sign up"}
          </button>
          <button
            type="button"
            className="text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
            onClick={() => {
              setError(null);
              setStep(step === "signIn" ? "signUp" : "signIn");
            }}
          >
            {step === "signIn"
              ? "Need an account? Sign up"
              : "Have an account? Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
