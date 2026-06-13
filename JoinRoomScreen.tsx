import { useState } from 'react';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { Button } from '@/components/common/Button';
import { NameSetupScreen } from '@/components/NameSetupScreen';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { useRoomStore } from '@/store/roomStore';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { joinRoom, RoomServiceError } from '@/lib/roomService';
import { isValidRoomCode, normalizeRoomCode } from '@/utils/identifiers';
import { saveActiveRoom } from '@/lib/sessionPersistence';

export function JoinRoomScreen() {
  const setScreen = useUIStore((s) => s.setScreen);
  const showToast = useUIStore((s) => s.showToast);
  const { uid, preferredName, preferredAvatarId, preferredColorId } = useAuthStore();
  const subscribeToRoom = useRoomStore((s) => s.subscribeToRoom);

  const [code, setCode] = useState(() => {
    const prefill = useUIStore.getState().prefillJoinCode;
    if (prefill) {
      useUIStore.getState().setPrefillJoinCode(null);
      return prefill;
    }
    return '';
  });
  const [needsNameSetup, setNeedsNameSetup] = useState(false);

  const normalized = normalizeRoomCode(code);
  const isValid = isValidRoomCode(normalized);

  const [handleJoin, pending] = useAsyncAction(async () => {
    if (!uid || !isValid) return;

    if (!preferredName.trim()) {
      setNeedsNameSetup(true);
      return;
    }

    try {
      const joined = await joinRoom(normalized, uid, preferredName, preferredAvatarId, preferredColorId);
      saveActiveRoom(joined);
      subscribeToRoom(joined);
      setScreen('lobby');
    } catch (err) {
      const message =
        err instanceof RoomServiceError
          ? err.message
          : 'Could not join the room. Check your connection and try again.';
      showToast(message, 'error');
    }
  });

  if (needsNameSetup) {
    return <NameSetupScreen onConfirm={handleJoin} />;
  }

  return (
    <div className="flex h-full flex-col">
      <ScreenHeader title="Join Room" onBack={() => setScreen('home')} />

      <div className="flex flex-1 flex-col px-6 pt-6">
        <p className="mb-2 text-center text-sm text-white/50">
          Enter the 6-character room code your friend shared with you.
        </p>

        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
          placeholder="ABC123"
          maxLength={6}
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          inputMode="text"
          className="mt-4 w-full rounded-xl2 bg-ink-800 px-4 py-5 text-center font-display text-3xl font-bold uppercase tracking-[0.3em] text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-signal"
        />

        {code.length > 0 && !isValid && (
          <p className="mt-2 text-center text-xs text-alert">
            Room codes are 6 letters or numbers.
          </p>
        )}
      </div>

      <div className="px-4 pb-4">
        <Button onClick={handleJoin} pending={pending} disabled={!isValid} className="w-full">
          Join Room
        </Button>
      </div>
    </div>
  );
}
