import { initializeApp, type FirebaseOptions } from 'firebase/app';
import {
  signInAnonymously,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import { initDevAwareAuth } from '@/lib/devtools/devIdentity';

// -----------------------------------------------------------------------
// Firebase configuration is loaded from environment variables.
// Copy .env.example to .env.local and fill in your Firebase project values.
// Vite exposes variables prefixed with VITE_ to client code.
// -----------------------------------------------------------------------
const firebaseConfig: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
};

function assertConfig(config: FirebaseOptions) {
  const required: (keyof FirebaseOptions)[] = [
    'apiKey',
    'authDomain',
    'projectId',
    'appId',
    'databaseURL',
  ];
  const missing = required.filter((key) => !config[key]);
  if (missing.length > 0) {
    // eslint-disable-next-line no-console
    console.error(
      `[firebase] Missing required config values: ${missing.join(
        ', '
      )}. Did you create a .env.local from .env.example?`
    );
  }
}

assertConfig(firebaseConfig);

export const app = initializeApp(firebaseConfig);

// -----------------------------------------------------------------------
// Explicit persistence chain for anonymous auth.
//
// Goal: a player's anonymous Firebase UID — and therefore their identity
// as a specific player in a room — survives page reloads, closing and
// reopening Safari, and brief connectivity loss.
//
// `initDevAwareAuth` uses the same ordered persistence list as before
// (indexedDB -> localStorage -> in-memory) UNLESS this is a dev build
// AND the current tab has opted into "multi-tab identity" mode via the
// dev panel (see src/lib/devtools/devIdentity.ts) — in which case this
// tab gets an independent in-memory-only identity so multiple tabs can
// join the same room as different players for local QA. This has NO
// effect on production builds.
//   1. indexedDBLocalPersistence — survives full app/browser close on
//      iOS Safari and standalone home-screen apps (most durable).
//   2. browserLocalPersistence  — localStorage-based fallback if
//      IndexedDB is unavailable (e.g. some private-browsing contexts).
//   3. inMemoryPersistence      — last resort; identity only survives
//      within the current tab session (no persistence across reload).
//      The room-rejoin flow (sessionPersistence.ts) still allows
//      *rejoining the room* in this case, but the player will get a
//      fresh anonymous UID and therefore a new player slot — handled
//      gracefully by the lobby's "no longer in this room" state.
// -----------------------------------------------------------------------
export const auth = initDevAwareAuth(app);

export const db = getDatabase(app);

/**
 * Ensures the current user is signed in anonymously, resolving once
 * authentication completes. Safe to call multiple times — subsequent
 * calls resolve immediately if already authenticated.
 */
export function ensureAnonymousAuth(): Promise<User> {
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        if (user) {
          unsubscribe();
          resolve(user);
        } else {
          signInAnonymously(auth).catch((err) => {
            unsubscribe();
            reject(err);
          });
        }
      },
      (err) => {
        unsubscribe();
        reject(err);
      }
    );
  });
}
