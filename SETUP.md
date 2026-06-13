# Local Development Setup

This guide covers running Shadow Circuit locally. For Firebase backend
configuration (creating a project, enabling Anonymous Auth and Realtime
Database, getting config values, deploying rules), see
**FIREBASE_SETUP.md** — do that first if you haven't already.

## 1. Prerequisites

- Node.js 18+ and npm
- A Firebase project configured per FIREBASE_SETUP.md (Realtime
  Database + Anonymous Authentication enabled, security rules deployed)
- Firebase CLI (`npm install -g firebase-tools`) — only needed for
  deploying database rules (FIREBASE_SETUP.md step 6)

## 2. Configure environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local` and fill in every value per FIREBASE_SETUP.md step 5.
**Do not commit `.env.local`** (it's gitignored).

## 3. Install dependencies

```bash
npm install
```

## 4. Run locally

```bash
npm run dev
```

Open the printed local URL (default `http://localhost:5173`). For
testing on an actual phone over your LAN, Vite's `--host` flag (already
enabled via `server.host: true` in `vite.config.ts`) lets you visit
`http://<your-computer-ip>:5173` from your phone's browser, as long as
both devices are on the same network.

## 5. Building for production

```bash
npm run build
```

Output goes to `dist/`. Preview the production build locally with:

```bash
npm run preview
```

See `DEPLOYMENT.md` for hosting-specific steps (Vercel, GitHub Pages,
and/or Firebase Hosting).

## 6. Troubleshooting

See FIREBASE_SETUP.md's troubleshooting table for connection/auth/
permission issues — most local setup problems are Firebase
configuration issues, not app issues.
