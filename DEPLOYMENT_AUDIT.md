# Deployment Readiness Audit

Scope: can someone clone this repo, configure it, run it locally, and
deploy it to Vercel/GitHub Pages using documentation alone, with zero
manual code changes? This audit found and fixed several real issues —
the "before" state had multiple deployment blockers; the "after" state
(reflected in the current repo) does not.

---

## 1. Environment Variables

Before: `.env.example` existed and was already complete and accurate
against `src/lib/firebase.ts`. `.env.local.example` / `.env.sample` did
not exist (not needed — `.env.example` is the standard convention and is
referenced consistently throughout the docs).

Every `VITE_*` variable the app reads (from `src/lib/firebase.ts` and
`vite.config.ts`):

| Variable | Required by app | In `.env.example`? |
|---|---|---|
| `VITE_FIREBASE_API_KEY` | Yes (assertConfig) | Yes |
| `VITE_FIREBASE_AUTH_DOMAIN` | Yes (assertConfig) | Yes |
| `VITE_FIREBASE_PROJECT_ID` | Yes (assertConfig) | Yes |
| `VITE_FIREBASE_STORAGE_BUCKET` | No — accepted, unused | Yes |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | No — accepted, unused | Yes |
| `VITE_FIREBASE_APP_ID` | Yes (assertConfig) | Yes |
| `VITE_FIREBASE_DATABASE_URL` | Yes (assertConfig) | Yes |
| `VITE_BASE_PATH` | No (defaults to `/`, read in vite.config.ts) | Yes |

**Verdict: no required variable is missing from `.env.example`.** This
was already correct before this audit.

Gap found and fixed: nothing in the docs previously called out which of
these are required vs. cosmetic, or that `VITE_FIREBASE_DATABASE_URL`
comes from a different Firebase Console page than the rest (an easy
first-time mistake). `docs/FIREBASE_SETUP.md` (new) now has an explicit
table with a "Required?" column and calls this out directly.

---

## 2. Firebase Configuration

Verified against `src/lib/firebase.ts`'s `firebaseConfig` object and
`assertConfig()`:

- `apiKey`, `authDomain`, `projectId`, `appId`, `databaseURL` — required,
  enforced by `assertConfig` (logs a console error and the app won't
  function if any are missing/empty).
- `storageBucket`, `messagingSenderId` — passed through but not in the
  required list; the app uses no Cloud Storage or Cloud Messaging
  features anywhere in `src/`.

**`VITE_FIREBASE_DATABASE_URL` is required**: confirmed via
`getDatabase(app)` (Realtime Database client) and `assertConfig`'s
`required` array, which explicitly includes `'databaseURL'`.

Documentation status:
- Before: `docs/SETUP.md` mentioned the database URL but didn't connect
  it clearly to "this is a different page than the web app config, and
  it's required."
- After: `docs/FIREBASE_SETUP.md` (new) has a dedicated step (step 3)
  for obtaining the Database URL, a mapping table (step 5) marking it
  Required, and a troubleshooting row specifically about region/URL
  mistakes causing silent hangs.

---

## 3. Firebase Initialization

- **Anonymous Authentication**: required — `ensureAnonymousAuth()` in
  `firebase.ts` calls `signInAnonymously(auth)` if no user is signed in.
  If the Anonymous provider isn't enabled in the Firebase project, this
  call fails and the app never gets past "Connecting…". Documented in
  `docs/FIREBASE_SETUP.md` step 2, with a troubleshooting row.
- **Realtime Database**: required — `getDatabase(app)` plus
  `database.rules.json` define the entire data model; there is no
  Firestore fallback anywhere in the codebase. Documented in
  `docs/FIREBASE_SETUP.md` steps 3 and 6 (rules deployment).
- **Full setup steps for a new developer**: previously split unevenly,
  with `docs/SETUP.md` mixing Firebase-project setup with local dev
  commands. Now:
  - `docs/FIREBASE_SETUP.md` (new): Firebase project creation through
    rules deployment and authorized domains — backend only,
    host-agnostic.
  - `docs/SETUP.md` (rewritten, trimmed): local dev commands only,
    referencing FIREBASE_SETUP.md for backend steps.
  - `docs/QUICK_START.md` (new): condensed end-to-end path combining
    both, for the minimum-reading version.

**Verdict: initialization requirements are fully documented and verified
to match the code exactly** — every field in `firebaseConfig` and
`assertConfig`'s `required` array was cross-checked against the new docs
tables.

---

## 4. Deployment Audit

### Vercel

Before: Vercel was not mentioned anywhere in the documentation, and no
`vercel.json` existed. Vercel's auto-detection for Vite projects would
likely work out of the box (build command `npm run build`, output
`dist`) — so this wasn't a hard build-failure blocker — but:
- Nothing told a new developer that `VITE_BASE_PATH` must be left UNSET
  on Vercel (it's only for GitHub Pages subpaths) — copy-pasting it from
  a GitHub Pages config would silently break asset paths.
- Nothing told them to add the Vercel domain to Firebase's authorized
  domains — without this, the deployed app fails anonymous auth with
  `auth/unauthorized-domain` while working fine locally, a confusing
  "works on my machine" failure.

Fixed:
- Added `vercel.json` (explicit `buildCommand`, `outputDirectory: dist`,
  `installCommand`, `framework: vite`) — removes reliance on
  auto-detection.
- Added a full Vercel section to `docs/DEPLOYMENT.md` (now "Option A",
  first/recommended) covering env var setup, the `VITE_BASE_PATH`
  gotcha, and authorized domains.
- Noted explicitly that no SPA-fallback rewrite is needed — this app has
  no client-side router (`src/App.tsx` is a single in-memory state
  machine with exactly one route, `/`), so there's nothing to fall back
  from. (If a router is added later, `vercel.json` would need a catch-all
  rewrite — noted for future-proofing.)

### GitHub Pages

Before: well-documented already (`VITE_BASE_PATH`, GitHub Actions
workflow example, authorized domains) — but the build had a real bug
that a subpath deployment would expose immediately:

- `index.html` referenced `/icons/icon-192.png`, `/manifest.webmanifest`
  with absolute root paths.
- `public/icons/` did not exist at all — both icon files were missing
  entirely (404 even at root deploy).
- Absolute `/...` paths additionally break under a non-root `base`
  (e.g. `/shadow-circuit/icons/...` would be needed, but Vite doesn't
  rewrite raw absolute hrefs in `index.html` — only the bundled
  `<script>`/`<link rel="stylesheet">` tags it controls).

Fixed (see section 6 for full details):
- Generated `public/icons/icon-192.png` and `icon-512.png`.
- Changed `index.html`'s `apple-touch-icon`/`icon`/`manifest` hrefs from
  `/icons/...` / `/manifest.webmanifest` to relative `./icons/...` /
  `./manifest.webmanifest`.
- Changed `manifest.webmanifest`'s `start_url` from `/` to `.`, and its
  icon `src` values from `/icons/...` to `icons/...`.
- Verified via an actual build with `VITE_BASE_PATH=/shadow-circuit/`
  that the resulting `dist/index.html` has correct relative icon/manifest
  references alongside correctly-prefixed `/shadow-circuit/assets/...`
  script/style tags.

### Firebase Hosting

Unaffected by the above (root deploy, `VITE_BASE_PATH` unset) — already
documented and working; relabeled "Option C" after inserting the new
Vercel section.

### Deployment blockers identified

1. **Missing PWA icon files** (`public/icons/icon-192.png`,
   `icon-512.png`) — referenced 3x in `index.html` + 2x in
   `manifest.webmanifest`, all would 404. FIXED (generated placeholder
   icons matching the app's color palette).
2. **Absolute-path icon/manifest references break under GitHub Pages
   subpath `base`**. FIXED (converted to relative paths, verified
   against an actual subpath build).
3. **No Vercel documentation or config** — not a hard build-failure
   blocker, but a real first-time-user blocker (silent
   `auth/unauthorized-domain` failures, `VITE_BASE_PATH` footgun). FIXED
   (new `vercel.json` + DEPLOYMENT.md section).
4. **Stray compiled `vite.config.js`/`vite.config.d.ts` in the repo
   root**, regenerated by every `npm run build` (because
   `tsconfig.node.json` is a composite project with default emit
   behavior and no `outDir`). A `.js` file next to `vite.config.ts` is a
   latent footgun — some Node resolution paths prefer `.js` over `.ts`,
   so an out-of-date compiled copy could silently diverge from source.
   FIXED: added `"outDir": "./.tsbuild/node"` to `tsconfig.node.json`,
   removed the existing stray files, and added `*.tsbuildinfo` /
   `.tsbuild/` to `.gitignore`. Verified `npm run build` no longer
   recreates them in root.

---

## 5. Build Verification

All three commands run from a clean state (`rm -rf node_modules dist
.tsbuild *.tsbuildinfo`, no `.env.local` present):

| Command | Result |
|---|---|
| `npm install` | Succeeds. Produces `npm audit` warnings for `esbuild`/`undici` — see "Non-blocking notes" below; transitive dev-tooling advisories, not runtime/production issues. |
| `npm run build` (= `tsc -b && vite build`) | Succeeds with NO env vars set at all — `tsc -b` type-checks cleanly, `vite build` inlines `import.meta.env.VITE_*` as `undefined` where unset (the app would show the `[firebase] Missing required config values` console error at RUNTIME, but the BUILD itself doesn't require real Firebase credentials). Output: `dist/index.html`, `dist/assets/*.{js,css}`, `dist/manifest.webmanifest`, `dist/icons/*.png`. No stray files left in repo root. |
| `npm run preview` | Serves `dist/` correctly. Verified via curl: `/` -> 200, `/manifest.webmanifest` -> 200, `/icons/icon-192.png` -> 200, `/icons/icon-512.png` -> 200 (all four were 404 before the icon fix). |

Also verified `npm run lint` (= `eslint .`) passes with zero
errors/warnings on a clean install.

**Missing files found**: only the PWA icons (section 4/6) — no other
missing files, configs, or assets were found. `firebase.json`,
`.firebaserc` (with placeholder project id, correctly so — it's
per-developer), `database.rules.json`, `tailwind.config.js`,
`postcss.config.js`, `.eslintrc.cjs` are all present and consistent.

### Non-blocking notes

- `npm audit` reports high-severity advisories for `esbuild` (via Vite's
  dev server) and `undici` (transitive, via Firebase's Node-side
  tooling). Both are dev/tooling-only — they affect `npm run dev`'s dev
  server and CLI tooling, not the static production bundle served by
  Vercel/GitHub Pages/Firebase Hosting. A fix is available via `npm audit
  fix --force`, but it bumps Vite to a major version (v8) — out of scope
  here since it would need full re-verification of the build/dev-server
  config. Recommend a dedicated dependency-update pass, not bundled into
  a deployment audit.
- The production JS bundle is ~698 KB (192 KB gzipped) in a single
  chunk, triggering Vite's "chunks larger than 500kB" warning. Not a
  deployment blocker — builds and serves fine — but worth a future
  code-splitting pass (manualChunks or dynamic import() for the 9
  minigames and the devtools panel).

---

## 6. Missing Files Audit

| File | Status before | Action |
|---|---|---|
| `.env.example` | Existed, complete and correct | None needed |
| `DEPLOYMENT.md` | Existed (GitHub Pages + Firebase Hosting), missing Vercel | Added Vercel section (now Option A), relabeled Firebase Hosting to Option C, fixed a stale cross-reference to FIREBASE_SETUP.md |
| `FIREBASE_SETUP.md` | Missing | Created — full Firebase project setup (project creation, Anonymous Auth, Realtime Database + Database URL, web app registration, env var mapping table, rules deployment, authorized domains, troubleshooting table) |
| `QUICK_START.md` | Missing | Created — condensed end-to-end path (Firebase project -> local run -> production build check -> deploy), plus a "common gotchas" section |

Additionally found missing (discovered during build/serve verification,
not in your original checklist but directly affects deployability):

| File | Status before | Action |
|---|---|---|
| `public/icons/icon-192.png` | Missing (referenced by index.html + manifest) | Created (192x192 PNG, app color palette) |
| `public/icons/icon-512.png` | Missing (referenced by manifest) | Created (512x512 PNG, app color palette) |
| `vercel.json` | Missing | Created (explicit build config) |

And one repo-hygiene issue found during build verification:

| Issue | Action |
|---|---|
| Stray `vite.config.js` / `vite.config.d.ts` regenerated in repo root by every `tsc -b` | Fixed via `tsconfig.node.json`'s new `outDir`; removed existing stray copies; added `.tsbuildinfo`/`.tsbuild/` to `.gitignore` |

---

## 7. First-Time User Experience

Walking through `docs/QUICK_START.md` (new) as a first-time user with no
prior knowledge of the project:

1. **Install dependencies** — `npm install`. Documented, verified working
   from a clean state.
2. **Configure Firebase** — create project, enable Anonymous Auth +
   Realtime Database, get web config + Database URL, fill `.env.local`.
   Now fully documented in `FIREBASE_SETUP.md` with an exact
   variable-mapping table and an explicit "this is a different page"
   callout for the Database URL (previously the single most likely point
   of confusion).
3. **Run locally** — `npm run dev`, plus a troubleshooting table for the
   most likely failure ("stuck on Connecting…" -> wrong Database URL or
   undeployed rules). Documented and verified.
4. **Deploy to Vercel** — env var setup (with the `VITE_BASE_PATH` gotcha
   called out), authorized-domain step, and confirmation that no extra
   routing config is needed. Now documented (previously absent entirely).

Before this audit, a first-time user following only the existing docs
would have: (a) had no idea the Database URL comes from a different page
than the web config — likely a silent "Connecting…" hang with nothing
pointing at the cause; (b) had no Vercel instructions at all, and if they
guessed to set `VITE_BASE_PATH` the same way as GitHub Pages, would get a
broken deploy; (c) on any host, hit four 404s (icon-192, icon-512, and
the manifest's two icon references) and a broken PWA manifest — though
the core app would still load and function (these 404s are non-fatal;
the app doesn't depend on the icons loading to run).

After this audit, all of the above is fixed or documented. A first-time
user can go from clone to a working Vercel deployment using
documentation alone, with the documented steps matching the actual code
exactly (every env var, every file path, every config value verified
against source).

---

## 8. Final Report

### Classification: Deployable

Not "Production Deployable" — that classification should be reserved
until the findings in `docs/SECURITY_AUDIT.md` are addressed (hidden
roles are fully readable by any client, and several actions — forcing
win conditions, fake kills, host takeover — are exploitable via direct
database writes, independent of deployment mechanics). This audit was
scoped to deployment, not security, and the two are independent: the app
deploys and runs correctly, but "runs correctly" includes "every player
can see every role," which is an integrity issue, not a deployment one.

Not merely "Deployable With Manual Setup" — that classification would
apply if a developer still needed to hand-edit code, hunt down missing
assets, or guess at undocumented configuration after following the docs.
Before this audit, that WAS the state (missing icons, no Vercel docs, an
undocumented Database-URL gotcha, and a latent stray-file build issue).
All of those have been fixed or documented in this pass.

**Why "Deployable" fits**: following `docs/QUICK_START.md` ->
`docs/FIREBASE_SETUP.md` -> `docs/DEPLOYMENT.md` in order, a developer
with zero prior knowledge of this project can install dependencies,
create and configure a Firebase project (Anonymous Auth + Realtime
Database + rules), run the app locally, verify the production build, and
deploy to Vercel (or GitHub Pages, or Firebase Hosting) — with no code
edits required at any point, only configuration (`.env.local` values
and, for GitHub Pages only, one build-time env var). Every required
environment variable is documented, matches the code exactly, and was
verified by running the actual build/preview pipeline from a clean state.

### Summary of changes made in this audit

- `tsconfig.node.json`: added `outDir` to stop stray `vite.config.js`/
  `.d.ts` regeneration; removed existing stray copies.
- `.gitignore`: added `*.tsbuildinfo` and `.tsbuild/`.
- `public/icons/icon-192.png`, `public/icons/icon-512.png`: created (were
  missing entirely).
- `index.html`: icon/manifest links changed from absolute (`/...`) to
  relative (`./...`) paths for subpath-deployment compatibility.
- `public/manifest.webmanifest`: `start_url` and icon `src` values
  changed from absolute to relative for the same reason.
- `vercel.json`: created (explicit Vite build config).
- `docs/FIREBASE_SETUP.md`: created (canonical Firebase backend setup).
- `docs/QUICK_START.md`: created (condensed end-to-end path).
- `docs/SETUP.md`: rewritten/trimmed to local-dev-only, referencing
  FIREBASE_SETUP.md.
- `docs/DEPLOYMENT.md`: added Vercel section (Option A), relabeled
  Firebase Hosting to Option C, fixed a stale doc cross-reference.
- `README.md`: updated doc links to include the two new guides.

All changes verified via a full clean-state `npm install && npm run
build && npm run preview` pass, plus an additional `VITE_BASE_PATH`
subpath build to confirm the icon/manifest path fixes work under GitHub
Pages-style deployment.
