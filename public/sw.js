// Bump this when making meaningful SW changes; old caches get purged on activate.
const VERSION = "v1";
const STATIC_CACHE = `enji-static-${VERSION}`;
const PAGES_CACHE = `enji-pages-${VERSION}`;
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PAGES_CACHE);
      await cache.add(new Request(OFFLINE_URL, { cache: "reload" }));
      self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => !k.endsWith(VERSION))
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // Only handle same-origin requests. Convex, auth endpoints, etc. are cross-origin
  // or sensitive and should bypass the cache entirely.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // Navigation requests (HTML pages): network-first, fall back to offline page.
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          return fresh;
        } catch {
          const cache = await caches.open(PAGES_CACHE);
          const offline = await cache.match(OFFLINE_URL);
          if (offline) return offline;
          return Response.error();
        }
      })(),
    );
    return;
  }

  // Build-hashed static assets: cache-first (safe, immutable URLs).
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(STATIC_CACHE);
        const cached = await cache.match(req);
        if (cached) return cached;
        const fresh = await fetch(req);
        if (fresh.ok) cache.put(req, fresh.clone());
        return fresh;
      })(),
    );
    return;
  }

  // Generated icons, manifest, and fonts: stale-while-revalidate for fast repeat loads.
  if (
    url.pathname.startsWith("/icon") ||
    url.pathname === "/apple-icon" ||
    url.pathname === "/manifest.webmanifest" ||
    /\.(woff2?|ttf|otf)$/.test(url.pathname)
  ) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(STATIC_CACHE);
        const cached = await cache.match(req);
        const fetchPromise = fetch(req).then((res) => {
          if (res.ok) cache.put(req, res.clone());
          return res;
        });
        return cached ?? fetchPromise;
      })(),
    );
  }
});
