export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="max-w-sm text-center">
        <h1 className="text-2xl font-semibold tracking-tight">You&apos;re offline</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Enji Life needs a connection to sync your logs. Reconnect and we&apos;ll
          pick up right where you left off.
        </p>
      </div>
    </main>
  );
}
