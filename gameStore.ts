import { create } from 'zustand';
import { onValue, ref, type Unsubscribe } from 'firebase/database';
import { db } from '@/lib/firebase';
import type { GameState, PlayerRole } from '@/types';

interface GameStoreState {
  gameId: string | null;
  game: GameState | null;
  loading: boolean;
  error: string | null;
  // The current player's secret role, synced separately via the
  // /games/{code}/secrets/{uid} path (read-restricted to that uid).
  myRole: PlayerRole | null;
  _unsubGame: Unsubscribe | null;
  _unsubSecret: Unsubscribe | null;

  subscribeToGame: (roomCode: string, uid: string) => void;
  unsubscribeFromGame: () => void;
}

export const useGameStore = create<GameStoreState>((set, get) => ({
  gameId: null,
  game: null,
  loading: false,
  error: null,
  myRole: null,
  _unsubGame: null,
  _unsubSecret: null,

  subscribeToGame: (roomCode: string, uid: string) => {
    get()._unsubGame?.();
    get()._unsubSecret?.();

    set({ gameId: roomCode, loading: true, error: null, game: null, myRole: null });

    const gameRef = ref(db, `games/${roomCode}`);
    const unsubGame = onValue(
      gameRef,
      (snapshot) => {
        const value = snapshot.val() as GameState | null;
        set({ game: value, loading: false });
      },
      (err) => set({ error: err.message, loading: false })
    );

    const secretRef = ref(db, `games/${roomCode}/secrets/${uid}/role`);
    const unsubSecret = onValue(secretRef, (snapshot) => {
      const value = snapshot.val() as PlayerRole | null;
      set({ myRole: value });
    });

    set({ _unsubGame: unsubGame, _unsubSecret: unsubSecret });
  },

  unsubscribeFromGame: () => {
    get()._unsubGame?.();
    get()._unsubSecret?.();
    set({
      gameId: null,
      game: null,
      loading: false,
      error: null,
      myRole: null,
      _unsubGame: null,
      _unsubSecret: null,
    });
  },
}));
