import Link from "next/link";
import { DesktopNav, MobileTabBar } from "@/components/AppNav";
import SignOutButton from "@/components/SignOutButton";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/80 backdrop-blur pt-[env(safe-area-inset-top)] dark:border-neutral-800 dark:bg-neutral-950/80">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-2 px-4 py-3">
          <Link
            href="/dashboard"
            className="font-semibold tracking-tight text-base sm:text-lg"
          >
            Enji Life
          </Link>
          <div className="flex items-center gap-1">
            <DesktopNav />
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] sm:py-8">
        {children}
      </main>
      <MobileTabBar />
    </div>
  );
}
