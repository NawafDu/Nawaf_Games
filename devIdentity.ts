import {
  initializeAuth,
  inMemoryPersistence,
  indexedDBLocalPersistence,
  browserLocalPersistence,
} from 'firebase/auth';
import type { Auth } from 'firebase/auth';
import type { FirebaseApp } from 'firebase/app';

// -----------------------------------------------------------------------
// Multi-tab identity for local QA (dev builds only).
//
// PROBLEM: Firebase's recommended persistence chain
// (indexedDBLocalPersistence -> browserLocalPersistence ->
// inMemoryPersistence) is shared across same-origin tabs/windows. That's
// exactly what production wants (a player's identity survives reload /
// app restart) — but it means every tab signs in as the SAME anonymous
// uid, making it impossible to open two tabs and join a room as two
// different "players" for local multiplayer QA.
//
// FIX (dev only): if `sessionStorage` (which IS per-tab, unlike
// localStorage/IndexedDB) contains a "dev multi-tab" flag, initialize
// auth with `inMemoryPersistence` ONLY. Each tab then gets its own
// anonymous uid on load.
//
// This module is only imported from firebase.ts behind an
// `import.meta.env.DEV` check, so it never affects production bundles
// or behavior — see firebase.ts for the gating.
// -----------------------------------------------------------------------

const MULTI_TAB_FLAG_KEY = 'shadowcircuit.dev.multiTabIdentity';

/**
 * Returns true if this tab has opted into the per-tab identity mode.
 * Controlled by the dev panel (DevPanel.tsx), which sets
 * `sessionStorage` and then reloads the tab so auth re-initializes
 * before any Firebase calls are made.
 */
export function isDevMultiTabIdentityEnabled(): boolean {
  try {
    return sessionStorage.getItem(MULTI_TAB_FLAG_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Enables per-tab identity for the CURRENT tab and reloads it. Other
 * tabs are unaffected (sessionStorage is per-tab). Call again with
 * `false` to disable and reload back to shared (default) identity.
 */
export function setDevMultiTabIdentity(enabled: boolean): void {
  try {
    if (enabled) {
      sessionStorage.setItem(MULTI_TAB_FLAG_KEY, 'true');
    } else {
      sessionStorage.removeItem(MULTI_TAB_FLAG_KEY);
      sessionStorage.removeItem('shadowcircuit.dev.preferredName');
      sessionStorage.removeItem('shadowcircuit.dev.preferredAvatarId');
      sessionStorage.removeItem('shadowcircuit.dev.preferredColorId');
    }
  } catch {
    /* sessionStorage unavailable — no-op */
  }
  window.location.reload();
}

/**
 * Initializes the Firebase Auth instance, choosing persistence based on
 * dev multi-tab mode. In production builds (or dev with multi-tab mode
 * off), this is identical to the original persistence chain.
 */
export function initDevAwareAuth(app: FirebaseApp): Auth {
  if (import.meta.env.DEV && isDevMultiTabIdentityEnabled()) {
    // Per-tab identity: in-memory only. Firebase Auth has no client API
    // to "sign in as a specific existing anonymous uid", so each reload
    // of a multi-tab-mode tab gets a NEW anonymous uid (and therefore a
    // new player slot if rejoining a room). Acceptable for local QA —
    // testers re-customize/re-join after a reload, and the dev panel
    // shows the current tab's uid so tabs are distinguishable.
    return initializeAuth(app, { persistence: [inMemoryPersistence] });
  }

  return initializeAuth(app, {
    persistence: [indexedDBLocalPersistence, browserLocalPersistence, inMemoryPersistence],
  });
}

/**
 * Dev-only per-tab storage for preferred name/avatar/color, so multiple
 * tabs in multi-tab identity mode don't all default to the same display
 * name (they'd still get auto-suffixed `#NN`, but distinct names make
 * tabs easier to tell apart). Falls back to the shared localStorage-
 * backed values when multi-tab mode is off.
 */
export function devPreferredStorage(key: 'preferredName' | 'preferredAvatarId' | 'preferredColorId') {
  const sessionKey = `shadowcircuit.dev.${key}`;
  return {
    get(fallback: string): string {
      if (!import.meta.env.DEV || !isDevMultiTabIdentityEnabled()) return fallback;
      try {
        return sessionStorage.getItem(sessionKey) ?? fallback;
      } catch {
        return fallback;
      }
    },
    set(value: string): boolean {
      if (!import.meta.env.DEV || !isDevMultiTabIdentityEnabled()) return false;
      try {
        sessionStorage.setItem(sessionKey, value);
        return true;
      } catch {
        return false;
      }
    },
  };
}
