import { create } from 'zustand';
import { devPreferredStorage } from '@/lib/devtools/devIdentity';

interface AuthState {
  uid: string | null;
  isAuthReady: boolean;
  // Locally remembered display name (persisted to localStorage) so the
  // player doesn't need to retype it each time.
  preferredName: string;
  preferredAvatarId: string;
  preferredColorId: string;

  setUid: (uid: string | null) => void;
  setAuthReady: (ready: boolean) => void;
  setPreferredName: (name: string) => void;
  setPreferredAvatarId: (id: string) => void;
  setPreferredColorId: (id: string) => void;
}

const STORAGE_KEYS = {
  name: 'shadowcircuit.preferredName',
  avatar: 'shadowcircuit.preferredAvatarId',
  color: 'shadowcircuit.preferredColorId',
};

function readLocal(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeLocal(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // localStorage unavailable (e.g. private mode) — fail silently.
  }
}

// Dev multi-tab mode (see src/lib/devtools/devIdentity.ts) stores
// preferred name/avatar/color in sessionStorage instead of localStorage,
// so each tab can have a distinct default identity. `devPreferredStorage`
// is a no-op passthrough (returns the fallback / does nothing) outside of
// dev multi-tab mode, so this has zero effect on production.
const devName = devPreferredStorage('preferredName');
const devAvatar = devPreferredStorage('preferredAvatarId');
const devColor = devPreferredStorage('preferredColorId');

export const useAuthStore = create<AuthState>((set) => ({
  uid: null,
  isAuthReady: false,
  preferredName: devName.get(readLocal(STORAGE_KEYS.name, '')),
  preferredAvatarId: devAvatar.get(readLocal(STORAGE_KEYS.avatar, 'orb')),
  preferredColorId: devColor.get(readLocal(STORAGE_KEYS.color, 'teal')),

  setUid: (uid) => set({ uid }),
  setAuthReady: (ready) => set({ isAuthReady: ready }),
  setPreferredName: (name) => {
    if (!devName.set(name)) writeLocal(STORAGE_KEYS.name, name);
    set({ preferredName: name });
  },
  setPreferredAvatarId: (id) => {
    if (!devAvatar.set(id)) writeLocal(STORAGE_KEYS.avatar, id);
    set({ preferredAvatarId: id });
  },
  setPreferredColorId: (id) => {
    if (!devColor.set(id)) writeLocal(STORAGE_KEYS.color, id);
    set({ preferredColorId: id });
  },
}));
