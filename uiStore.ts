import { create } from 'zustand';
import type { TutorialLanguage } from '@/lib/tutorialContent';

export type Screen =
  | 'home'
  | 'create_room'
  | 'join_room'
  | 'settings'
  | 'lobby'
  | 'match'
  | 'post_game'
  | 'tutorial'
  | 'practice_setup'
  | 'name_setup';

interface UIState {
  screen: Screen;
  // Generic modal/toast surface for non-blocking error/info messages.
  toast: { message: string; tone: 'info' | 'error' | 'success' } | null;
  // When set, the Join Room screen pre-fills this code (used when
  // offering to "rejoin" a room after identity/storage was lost).
  prefillJoinCode: string | null;
  // Which language the Tutorial screen renders in (set by which Home
  // screen "How To Play" button was tapped).
  tutorialLanguage: TutorialLanguage;

  setScreen: (screen: Screen) => void;
  showToast: (message: string, tone?: 'info' | 'error' | 'success') => void;
  clearToast: () => void;
  setPrefillJoinCode: (code: string | null) => void;
  setTutorialLanguage: (lang: TutorialLanguage) => void;
}

export const useUIStore = create<UIState>((set) => ({
  screen: 'home',
  toast: null,
  prefillJoinCode: null,
  tutorialLanguage: 'en',

  setScreen: (screen) => set({ screen }),
  showToast: (message, tone = 'info') => set({ toast: { message, tone } }),
  clearToast: () => set({ toast: null }),
  setPrefillJoinCode: (code) => set({ prefillJoinCode: code }),
  setTutorialLanguage: (lang) => set({ tutorialLanguage: lang }),
}));
