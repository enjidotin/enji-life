"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";

export default function SignOutButton() {
  const { signOut } = useAuthActions();
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await signOut();
        router.push("/signin");
      }}
      className="rounded-md border border-neutral-200 px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 active:bg-neutral-200 sm:py-1.5 dark:border-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
      aria-label="Sign out"
    >
      Sign out
    </button>
  );
}
