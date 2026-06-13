import { useState } from 'react';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { Button } from '@/components/common/Button';
import { NameSetupScreen } from '@/components/NameSetupScreen';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { useRoomStore } from '@/store/roomStore';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { createRoom, RoomServiceError } from '@/lib/roomService';
import { saveActiveRoom } from '@/lib/sessionPersistence';

export function CreateRoomScreen() {
  const setScreen = useUIStore((s) => s.setScreen);
  const showToast = useUIStore((s) => s.showToast);
  const { uid, preferredName, preferredAvatarId, preferredColorId } = useAuthStore();
  const subscribeToRoom = useRoomStore((s) => s.subscribeToRoom);

  const [needsNameSetup] = useState(!preferredName.trim());

  const [handleCreate, pending] = useAsyncAction(async () => {
    if (!uid) return;
    try {
      const code = await createRoom(uid, preferredName, preferredAvatarId, preferredColorId);
      saveActiveRoom(code);
      subscribeToRoom(code);
      setScreen('lobby');
    } catch (err) {
      const message =
        err instanceof RoomServiceError
          ? err.message
          : 'Could not create a room. Check your connection and try again.';
      showToast(message, 'error');
    }
  });

  if (needsNameSetup) {
    return <NameSetupScreen onConfirm={handleCreate} />;
  }

  return (
    <div className="flex h-full flex-col">
      <ScreenHeader title="Create Room" onBack={() => setScreen('home')} />

      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
        <div className="text-5xl">🛰️</div>
        <div>
          <h2 className="font-display text-lg font-semibold text-white">
            Start a new room
          </h2>
          <p className="mt-2 max-w-xs text-sm text-white/50">
            You'll get a 6-character room code to share with friends. You'll
            be the host — you can configure settings and add bots once
            you're in the lobby.
          </p>
        </div>
      </div>

      <div className="px-4 pb-4">
        <Button onClick={handleCreate} pending={pending} className="w-full">
          Create Room
        </Button>
      </div>
    </div>
  );
}
