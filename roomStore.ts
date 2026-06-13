import { create } from 'zustand';
import { onValue, ref, type Unsubscribe } from 'firebase/database';
import { db } from '@/lib/firebase';
import type { RoomData } from '@/types';

interface RoomState {
  roomCode: string | null;
  room: RoomData | null;
  loading: boolean;
  error: string | null;
  _unsubscribe: Unsubscribe | null;

  subscribeToRoom: (roomCode: string) => void;
  unsubscribeFromRoom: () => void;
  setError: (error: string | null) => void;
}

export const useRoomStore = create<RoomState>((set, get) => ({
  roomCode: null,
  room: null,
  loading: false,
  error: null,
  _unsubscribe: null,

  subscribeToRoom: (roomCode: string) => {
    // Tear down any existing subscription first.
    get()._unsubscribe?.();

    set({ roomCode, loading: true, error: null, room: null });

    const roomRef = ref(db, `rooms/${roomCode}`);
    const unsubscribe = onValue(
      roomRef,
      (snapshot) => {
        const value = snapshot.val() as RoomData | null;
        set({ room: value, loading: false });
      },
      (err) => {
        set({ error: err.message, loading: false });
      }
    );

    set({ _unsubscribe: unsubscribe });
  },

  unsubscribeFromRoom: () => {
    get()._unsubscribe?.();
    set({
      roomCode: null,
      room: null,
      loading: false,
      error: null,
      _unsubscribe: null,
    });
  },

  setError: (error) => set({ error }),
}));
