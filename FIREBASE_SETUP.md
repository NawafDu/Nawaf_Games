# Firebase Setup Guide

This guide covers everything needed to configure the Firebase backend
for Shadow Circuit — required regardless of where the frontend is
deployed (Vercel, GitHub Pages, Firebase Hosting, or local dev).

The app uses exactly two Firebase products:
- **Realtime Database** (NOT Firestore) — all room/game/chat state.
- **Authentication -> Anonymous** sign-in — every player is an anonymous
  Firebase user; their `uid` is their identity for the session.

No other Firebase products (Firestore, Storage, Functions, Hosting,
Analytics, etc.) are required. Firebase Hosting is optional (see
DEPLOYMENT.md).

---

## 1. Create or select a Firebase project

1. Go to the Firebase Console (https://console.firebase.google.com/).
2. Click "Add project" (or select an existing one).
3. Google Analytics is not used by this app — you can decline it during
   project creation.

---

## 2. Enable Anonymous Authentication

1. Left sidebar: Build -> Authentication.
2. Click "Get started" (if this is a new project).
3. Go to the "Sign-in method" tab.
4. Click "Anonymous" in the provider list.
5. Toggle "Enable", then "Save".

Without this step, every player's first load will fail to sign in and
the app will be stuck on "Connecting...".

---

## 3. Create a Realtime Database instance

1. Left sidebar: Build -> Realtime Database.
2. Click "Create Database".
3. Choose a location/region close to your expected players (this cannot
   be changed later without creating a new database).
4. For the initial security rules prompt, choose either option — you
   will overwrite these with `database.rules.json` in step 6 regardless.

After creation, note the **Database URL** shown at the top of the
Realtime Database page. It looks like one of:
- `https://<project-id>-default-rtdb.firebaseio.com` (older
  `us-central1` projects), or
- `https://<project-id>-default-rtdb.<region>.firebasedatabase.app`
  (newer, region-specific).

You'll need this exact URL for `VITE_FIREBASE_DATABASE_URL`. Getting the
region wrong is one of the most common setup mistakes — the app will
hang on "Connecting..." rather than showing a clear error, since
`.info/connected` simply never resolves against the wrong host.

---

## 4. Register a Web App and get your config values

1. Click the gear icon -> "Project settings".
2. Scroll to "Your apps". If no web app exists, click "Add app" -> the
   `</>` (Web) icon.
3. Give it any nickname (e.g. "Shadow Circuit Web"). You do NOT need to
   set up Firebase Hosting at this step (you can skip that checkbox).
4. After registering, Firebase shows a config object like:

```
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.firebasestorage.app",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:xxxxxxxxxxxxxxxxxxxxxx",
};
```

If you've already left this screen, find the same values again under
Project settings -> General -> Your apps -> (your web app) -> SDK setup
and configuration -> Config.

---

## 5. Map config values to environment variables

This project reads its Firebase config from Vite environment variables
(`VITE_*`, exposed to client code by Vite — see `src/lib/firebase.ts`).
Copy `.env.example` to `.env.local` for local development:

```bash
cp .env.example .env.local
```

| `.env.local` variable | From Firebase config | Required? |
|---|---|---|
| `VITE_FIREBASE_API_KEY` | `apiKey` | Yes |
| `VITE_FIREBASE_AUTH_DOMAIN` | `authDomain` | Yes |
| `VITE_FIREBASE_PROJECT_ID` | `projectId` | Yes |
| `VITE_FIREBASE_STORAGE_BUCKET` | `storageBucket` | No (app doesn't use Cloud Storage — harmless to set) |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` | No (app doesn't use Cloud Messaging — harmless to set) |
| `VITE_FIREBASE_APP_ID` | `appId` | Yes |
| `VITE_FIREBASE_DATABASE_URL` | the Database URL from step 3 (NOT part of the web config object from step 4 — get it from the Realtime Database page) | Yes |
| `VITE_BASE_PATH` | n/a — only for GitHub Pages subpath deploys (see DEPLOYMENT.md) | No (defaults to `/`) |

`src/lib/firebase.ts` treats `apiKey`, `authDomain`, `projectId`,
`appId`, and `databaseURL` as REQUIRED — if any are missing, the app
logs `[firebase] Missing required config values: ...` to the browser
console and Firebase initialization will fail (you'll see this before
anything else if setup is incomplete). `storageBucket` and
`messagingSenderId` are accepted but not used by any current code path —
including them is harmless and future-proofs against adding those
features later.

`VITE_FIREBASE_DATABASE_URL` deserves special attention: it is required
and is the single most common source of "stuck on Connecting..." issues,
because (a) it's not part of the config object copy-pasted in step 4 —
you must get it separately from the Realtime Database page (step 3), and
(b) a wrong region in the URL produces no error, just an indefinitely
pending connection.

---

## 6. Deploy security rules

The repository includes `database.rules.json`, which defines all access
control for `/rooms`, `/games`, `/chat`, and `/presence`. Firebase
projects default to deny-all — without deploying these rules, every
read/write from the app will fail with `PERMISSION_DENIED`.

```bash
npm install -g firebase-tools   # one-time, if not already installed
firebase login
firebase use --add              # select your project; alias it "default"
firebase deploy --only database
```

This reads `database.rules.json` (referenced from `firebase.json`) and
applies it to your project's Realtime Database. Re-run this command
EVERY TIME `database.rules.json` changes — it is not deployed
automatically by frontend builds/deploys (Vercel, GitHub Pages, etc. only
handle the static frontend).

Verify in Firebase Console -> Realtime Database -> "Rules" tab — it
should match `database.rules.json`.

---

## 7. (Deployed apps only) Add authorized domains

Firebase Authentication only works from domains explicitly authorized
for your project. `localhost` is authorized by default, so local dev
works without this step. For any deployed frontend:

1. Firebase Console -> Authentication -> Settings -> Authorized domains.
2. Click "Add domain" and add your deployment's domain (e.g.
   `your-app.vercel.app`, `<user>.github.io`, or your custom domain).

If skipped, anonymous sign-in fails with `auth/unauthorized-domain` on
the deployed site (but works fine locally) — if local dev works but a
deployment shows "Connecting..." or auth errors in the console, check
this first.

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Stuck on "Connecting..." | Wrong/missing `VITE_FIREBASE_DATABASE_URL` (step 3/5), or rules not deployed (step 6) |
| `[firebase] Missing required config values: ...` in console | `.env.local` missing/incomplete (local), or env vars not set in your hosting provider's dashboard (deployed) |
| `auth/unauthorized-domain` (deployed only, works locally) | Domain not added to authorized domains (step 7) |
| `PERMISSION_DENIED` on any read/write | `database.rules.json` not deployed (step 6), or Anonymous Auth not enabled (step 2) |
| Anonymous sign-in never resolves, no specific error | Anonymous Auth provider not enabled (step 2) |

For local-development steps (installing dependencies, running the dev
server), see SETUP.md. For frontend hosting steps, see DEPLOYMENT.md.
