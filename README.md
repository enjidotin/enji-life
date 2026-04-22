# Enji Life

A Next.js + Convex app for logging meals, workouts, weight, and progress photos, with auth via [Convex Auth](https://labs.convex.dev/auth).

## Stack

- **Next.js 16** (App Router, Turbopack)
- **Convex** (reactive database, serverless functions, file storage)
- **Convex Auth** (email + password, no third-party provider needed)
- **Tailwind CSS v4**

## First-time setup

```bash
npm install
```

### 1. Provision the Convex deployment

```bash
npx convex dev
```

This prompts you to log in, creates a dev deployment, writes `NEXT_PUBLIC_CONVEX_URL` into `.env.local`, and generates `convex/_generated/`. Leave this process running in one terminal — it watches `convex/` and pushes changes live.

### 2. Set auth environment variables on Convex

Convex Auth needs a JWT keypair and a site URL **on the deployment** (not in `.env.local`):

```bash
npx @convex-dev/auth
```

The interactive helper generates the key material and sets the env vars on your Convex deployment (`JWT_PRIVATE_KEY`, `JWKS`, `SITE_URL`). Use `http://localhost:3000` as the SITE_URL for local dev.

### 3. Run the Next.js app

In a second terminal:

```bash
npm run dev
```

Open http://localhost:3000 — you'll be redirected to `/signin`. Create an account and you're in.

## Layout

```
convex/
  schema.ts          # users (from authTables) + meals, workouts, weightLogs, progressPhotos
  auth.ts            # Password provider wiring
  auth.config.ts     # JWT provider config
  http.ts            # Mounts auth HTTP routes
  meals.ts / workouts.ts / weight.ts / photos.ts / users.ts

src/
  middleware.ts                      # Redirects unauth'd users to /signin
  app/
    layout.tsx                       # ConvexAuthNextjsServerProvider
    ConvexClientProvider.tsx         # ConvexAuthNextjsProvider (client)
    signin/page.tsx
    (app)/
      layout.tsx                     # App shell with nav + sign out
      dashboard/page.tsx
      meals/page.tsx
      workouts/page.tsx
      weight/page.tsx
      photos/page.tsx
  components/
    SignOutButton.tsx
    ui.tsx
```

## Deploy

- Push `convex/` to prod with `npx convex deploy`.
- Deploy the Next.js app to Vercel. Set `NEXT_PUBLIC_CONVEX_URL` to your prod deployment URL, and update `SITE_URL` on the Convex prod deployment to your Vercel URL.
