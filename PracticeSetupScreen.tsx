import { useState } from 'react';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { Button } from '@/components/common/Button';
import { NameSetupScreen } from '@/components/NameSetupScreen';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { useRoomStore } from '@/store/roomStore';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { createRoom, fillWithBots, updateRoomSettings, setReady, RoomServiceError } from '@/lib/roomService';
import { saveActiveRoom } from '@/lib/sessionPersistence';
import { DEFAULT_ROOM_SETTINGS, saboteurRange, type BotDifficulty } from '@/types';

const PLAYER_COUNT_OPTIONS = [4, 6, 8, 10, 12];
const DIFFICULTY_OPTIONS: { id: BotDifficulty; label: string; description: string }[] = [
  { id: 'easy', label: 'Easy', description: 'Bots make obvious mistakes — good for learning the ropes.' },
  { id: 'medium', label: 'Medium', description: 'Bots play sensibly and occasionally slip up.' },
  { id: 'hard', label: 'Hard', description: 'Bots track inconsistencies closely and vote sharply.' },
];

/**
 * Lets a solo player quickly spin up a room filled entirely with bots.
 * Creates a room, configures player count + difficulty, fills remaining
 * slots with bots, and marks the human player ready before entering the
 * lobby (where they can still tweak settings before starting).
 */
export function PracticeSetupScreen() {
  const setScreen = useUIStore((s) => s.setScreen);
  const showToast = useUIStore((s) => s.showToast);
  const { uid, preferredName, preferredAvatarId, preferredColorId } = useAuthStore();
  const subscribeToRoom = useRoomStore((s) => s.subscribeToRoom);

  const [needsNameSetup] = useState(!preferredName.trim());
  const [playerCount, setPlayerCount] = useState(8);
  const [difficulty, setDifficulty] = useState<BotDifficulty>('medium');

  const [handleStart, pending] = useAsyncAction(async () => {
    if (!uid) return;
    try {
      const code = await createRoom(uid, preferredName, preferredAvatarId, preferredColorId);

      const range = saboteurRange(playerCount);
      await updateRoomSettings(code, {
        ...DEFAULT_ROOM_SETTINGS,
        maxPlayers: playerCount,
        saboteurCount: range.min,
        botDifficulty: difficulty,
      });

      await fillWithBots(code, difficulty);
      await setReady(code, uid, true);

      saveActiveRoom(code);
      subscribeToRoom(code);
      setScreen('lobby');
    } catch (err) {
      const message =
        err instanceof RoomServiceError
          ? err.message
          : 'Could not start practice mode. Check your connection and try again.';
      showToast(message, 'error');
    }
  });

  if (needsNameSetup) {
    return <NameSetupScreen onConfirm={handleStart} />;
  }

  return (
    <div className="flex h-full flex-col">
      <ScreenHeader title="Practice with Bots" onBack={() => setScreen('home')} />

      <div className="flex-1 overflow-y-auto px-4 pb-4 no-scrollbar">
        <p className="mb-6 text-center text-sm text-white/50">
          Play a full match by yourself — every other seat is filled with a
          bot. Great for learning the map, tasks, and meeting flow.
        </p>

        <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-white/40">
          Total Players (including you)
        </label>
        <div className="mb-6 grid grid-cols-5 gap-2">
          {PLAYER_COUNT_OPTIONS.map((n) => (
            <button
              key={n}
              onClick={() => setPlayerCount(n)}
              className={`tap-target rounded-xl2 py-3 font-display text-sm font-semibold transition ${
                playerCount === n ? 'bg-signal text-ink-950' : 'bg-ink-800 text-white/70'
              }`}
            >
              {n}
            </button>
          ))}
        </div>

        <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-white/40">
          Bot Difficulty
        </label>
        <div className="flex flex-col gap-2">
          {DIFFICULTY_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setDifficulty(opt.id)}
              className={`tap-target rounded-xl2 p-4 text-left transition ${
                difficulty === opt.id ? 'bg-signal/15 ring-2 ring-signal' : 'bg-ink-800'
              }`}
            >
              <p className="font-display text-sm font-semibold text-white">{opt.label}</p>
              <p className="mt-1 text-xs text-white/50">{opt.description}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pb-4">
        <Button onClick={handleStart} pending={pending} className="w-full">
          Start Practice Room
        </Button>
      </div>
    </div>
  );
}
