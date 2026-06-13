# Quick Start

The fastest path from "just cloned this repo" to a running app and a
live deployment. For full detail/troubleshooting on any step, see
FIREBASE_SETUP.md, SETUP.md, and DEPLOYMENT.md.

## 1. Firebase backend (one-time, ~5 minutes)

1. Create a project at https://console.firebase.google.com/.
2. Authentication -> Sign-in method -> enable Anonymous.
3. Realtime Database -> Create Database (pick a region) -> note the
   Database URL shown at the top.
4. Project settings -> Your apps -> Add app -> Web -> copy the config
   object shown.

Full detail: FIREBASE_SETUP.md (steps 1-4).

## 2. Local setup (~2 minutes)

```bash
git clone <this-repo-url>
cd shadow-circuit
cp .env.example .env.local
```

Edit `.env.local`: fill in `VITE_FIREBASE_API_KEY`,
`VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`,
`VITE_FIREBASE_APP_ID` (all from step 1.4's config object), and
`VITE_FIREBASE_DATABASE_URL` (from step 1.3 — NOT in the config object).
`VITE_FIREBASE_STORAGE_BUCKET` / `VITE_FIREBASE_MESSAGING_SENDER_ID` can
be filled in from the same config object or left as placeholders — they
are accepted but unused.

```bash
npm install
```

## 3. Deploy database security rules (one-time per Firebase project)

```bash
npm install -g firebase-tools
firebase login
firebase use --add   # select your project from step 1
firebase deploy --only database
```

Without this, every read/write will fail with PERMISSION_DENIED.

## 4. Run locally

```bash
npm run dev
```

Open the printed URL (default http://localhost:5173). You should land
on the home screen and be able to create a room. If you see
"Connecting..." forever, double-check `VITE_FIREBASE_DATABASE_URL` (most
common mistake — see FIREBASE_SETUP.md troubleshooting).

## 5. Verify the production build (optional but recommended)

```bash
npm run build
npm run preview
```

Open the printed preview URL — should behave identically to `npm run dev`.

## 6. Deploy

**Vercel** (fastest): import the repo at https://vercel.com/new, add the
same `VITE_FIREBASE_*` env vars from step 2 under Project Settings ->
Environment Variables, deploy. Then add the resulting `*.vercel.app`
domain to Firebase Console -> Authentication -> Settings -> Authorized
domains.

**GitHub Pages** / **Firebase Hosting**: see DEPLOYMENT.md — both need a
couple of extra steps (base path for GitHub Pages; `firebase deploy` for
Firebase Hosting) but follow the same env-var setup.

## Common gotchas (read this if something's stuck)

- **Stuck on "Connecting..."**: wrong `VITE_FIREBASE_DATABASE_URL`, or
  rules not deployed (step 3).
- **"[firebase] Missing required config values"** in the browser
  console: `.env.local` incomplete (local) or env vars not set in your
  host's dashboard (deployed).
- **Works locally, fails when deployed** (`auth/unauthorized-domain`):
  add your deployed domain to Firebase Console -> Authentication ->
  Settings -> Authorized domains.
- **PERMISSION_DENIED**: step 3 (rules) not done, or Anonymous Auth
  (step 1.2) not enabled.
