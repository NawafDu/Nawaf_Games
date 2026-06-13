# Deployment Guide

Shadow Circuit's frontend is a static SPA and can be deployed to
**Vercel**, **GitHub Pages**, or **Firebase Hosting** (or several at
once). The Realtime Database and Auth backend is the same regardless of
where the frontend is hosted — see `FIREBASE_SETUP.md` for backend setup,
which must be done once regardless of frontend host.

---

## Option A: Vercel (recommended for quickest setup)

Vercel auto-detects this as a Vite project: build command `npm run
build` (actually `vite build`, but `npm run build` runs `tsc -b && vite
build` — use `npm run build`), output directory `dist`, install command
`npm install`. No `vercel.json` is required for a single-page app with no
client-side routes (this app has none — see note below), but the
settings below make the configuration explicit.

### One-time setup

1. Push this project to a GitHub/GitLab/Bitbucket repository (Vercel can
   also deploy from a local directory via `vercel` CLI, but git-based
   deploys are easiest for ongoing updates).
2. In the [Vercel dashboard](https://vercel.com/new), import the
   repository.
3. Framework preset: Vercel should auto-detect **Vite**. If prompted,
   confirm:
   - **Build command**: `npm run build`
   - **Output directory**: `dist`
   - **Install command**: `npm install`
4. **Environment variables** — under the project's *Settings →
   Environment Variables*, add all seven `VITE_FIREBASE_*` variables
   (see `.env.example` / `FIREBASE_SETUP.md` for where to get each
   value). Apply them to all environments (Production, Preview,
   Development) so preview deployments work too.
   - **Do not set `VITE_BASE_PATH`** on Vercel — leave it unset (or
     `/`). Vercel always serves from the domain root (or a root-mounted
     custom domain), so the default `base: '/'` in `vite.config.ts` is
     correct.
5. Deploy. Vercel will build and serve `dist/`.

### Important: Authorized domains for Firebase Auth

In Firebase Console → **Authentication → Settings → Authorized domains**,
add your Vercel deployment domain(s):
- The production domain (e.g. `your-app.vercel.app`, or your custom
  domain).
- If you want Vercel **preview deployments** (per-branch/PR URLs like
  `your-app-git-branch-team.vercel.app`) to work too, either add each
  preview domain individually, or add the wildcard pattern Firebase
  supports for your plan — check Firebase Console for current wildcard
  support, as this varies. At minimum, add the production domain.

### Note on routing

This app has **no client-side router** (no React Router) — the entire UI
is a single-page in-memory state machine (`src/App.tsx`'s `screen`
state), so there is only ever one route, `/`. This means **no SPA
fallback/rewrite configuration is needed** on Vercel (or any host):
there's nothing to fall back *from*. If client-side routing is added in
the future, a `vercel.json` with a catch-all rewrite to `/index.html`
would become necessary.

---

## Option B: GitHub Pages

### One-time setup

1. Push this project to a **public GitHub repository**.
2. In the repo: **Settings → Pages** → Source: "GitHub Actions" (recommended)
   or "Deploy from a branch" with a `gh-pages` branch.

### Build with the correct base path

GitHub Pages serves your site at `https://<user>.github.io/<repo-name>/`,
so the app's asset paths must be prefixed with `/<repo-name>/`.

```bash
VITE_BASE_PATH=/<repo-name>/ npm run build
```

(`vite.config.ts` reads `VITE_BASE_PATH`, defaulting to `/`.)

### Environment variables for the build

Since `.env.local` is not committed, your CI build needs the
`VITE_FIREBASE_*` values as build-time environment variables (Firebase
web config values are not secret, but keep them out of the repo for
cleanliness — see FIREBASE_SETUP.md). In GitHub Actions, add them as **repository
secrets** and reference them in the workflow's env block.

### Example GitHub Actions workflow

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build
        env:
          VITE_BASE_PATH: /${{ github.event.repository.name }}/
          VITE_FIREBASE_API_KEY: ${{ secrets.VITE_FIREBASE_API_KEY }}
          VITE_FIREBASE_AUTH_DOMAIN: ${{ secrets.VITE_FIREBASE_AUTH_DOMAIN }}
          VITE_FIREBASE_PROJECT_ID: ${{ secrets.VITE_FIREBASE_PROJECT_ID }}
          VITE_FIREBASE_STORAGE_BUCKET: ${{ secrets.VITE_FIREBASE_STORAGE_BUCKET }}
          VITE_FIREBASE_MESSAGING_SENDER_ID: ${{ secrets.VITE_FIREBASE_MESSAGING_SENDER_ID }}
          VITE_FIREBASE_APP_ID: ${{ secrets.VITE_FIREBASE_APP_ID }}
          VITE_FIREBASE_DATABASE_URL: ${{ secrets.VITE_FIREBASE_DATABASE_URL }}
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

Add the seven `VITE_FIREBASE_*` secrets under **Settings → Secrets and
variables → Actions → New repository secret**.

### Important: Authorized domains for Firebase Auth

In Firebase Console → **Authentication → Settings → Authorized domains**,
add `<user>.github.io` so anonymous auth works from your GitHub Pages
deployment.

---

## Option C: Firebase Hosting

```bash
npm run build
firebase deploy --only hosting,database
```

`firebase.json` is already configured with `public: "dist"` and an SPA
rewrite rule. With Firebase Hosting, `VITE_BASE_PATH` should be left
unset (defaults to `/`).

---

## Deploying database rules

**Whenever `database.rules.json` changes**, redeploy rules independently
of the frontend:

```bash
firebase deploy --only database
```

---

## Post-deployment checklist

- [ ] Anonymous auth works (check browser console for auth errors)
- [ ] Creating a room writes to `/rooms/{code}` (check Firebase Console →
      Realtime Database → Data tab)
- [ ] Security rules deployed (test that an unauthenticated read is
      denied — open the Database in an incognito tab without signing in)
- [ ] App loads correctly at the deployed base path (no broken
      asset/404s — check Network tab for 404s on `/assets/...`)
- [ ] iOS Safari: app installs to home screen in standalone mode (Share →
      Add to Home Screen) and respects safe areas on notch devices
