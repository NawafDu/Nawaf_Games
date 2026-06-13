import { useEffect, useState } from 'react';
import { ensureAnonymousAuth, auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { useRoomStore } from '@/store/roomStore';
import { LoadingScreen } from '@/components/common/LoadingScreen';
import { ConnectionBanner } from '@/components/common/ConnectionBanner';
import { Toast } from '@/components/common/Toast';
import { HomeScreen } from '@/components/HomeScreen';
import { CreateRoomScreen } from '@/components/CreateRoomScreen';
import { JoinRoomScreen } from '@/components/JoinRoomScreen';
import { PracticeSetupScreen } from '@/components/PracticeSetupScreen';
import { TutorialScreen } from '@/components/TutorialScreen';
import { LobbyScreen } from '@/components/LobbyScreen';
import { MatchScreen } from '@/components/MatchScreen';
import { PostGameScreen } from '@/components/PostGameScreen';
import { useGameStore } from '@/store/gameStore';
import { readActiveRoom, clearActiveRoom, touchActiveRoom } from '@/lib/sessionPersistence';
import { setupDisconnectHandler } from '@/lib/roomService';
import DevPanel from '@/components/devtools/DevPanel';

function PlaceholderScreen({ name }: { name: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center safe-area-screen">
      <p className="font-display text-lg text-white">{name}</p>
      <p className="text-sm text-white/50">
        Coming in a later phase of the build.
      </p>
    </div>
  );
}

const AUTH_TIMEOUT_MS = 10000;

export function App() {
  const { uid, isAuthReady, setUid, setAuthReady } = useAuthStore();
  const screen = useUIStore((s) => s.screen);
  const setScreen = useUIStore((s) => s.setScreen);
  const tutorialLanguage = useUIStore((s) => s.tutorialLanguage);
  const subscribeToRoom = useRoomStore((s) => s.subscribeToRoom);
  const room = useRoomStore((s) => s.room);

  const [authTimedOut, setAuthTimedOut] = useState(false);
  const [rejoinAttempted, setRejoinAttempted] = useState(false);

  // Auth bootstrap.
  useEffect(() => {
    ensureAnonymousAuth().catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[auth] Failed to sign in anonymously', err);
    });

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUid(user?.uid ?? null);
      setAuthReady(true);
    });

    return () => unsubscribe();
  }, [setUid, setAuthReady]);

  // Guard against an indefinite "Connecting…" screen if auth never
  // resolves (e.g. misconfigured Firebase project) — surface a retry
  // option rather than leaving the player stuck.
  useEffect(() => {
    if (isAuthReady) return;
    const timeout = setTimeout(() => setAuthTimedOut(true), AUTH_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, [isAuthReady]);

  // Auto-rejoin: if a room code was persisted from a previous session
  // (reload, brief disconnect, etc.), re-subscribe and re-register the
  // disconnect handler, then jump straight to the lobby.
  useEffect(() => {
    if (!isAuthReady || !uid || rejoinAttempted) return;
    setRejoinAttempted(true);

    const savedCode = readActiveRoom();
    if (!savedCode) return;

    subscribeToRoom(savedCode);
    setupDisconnectHandler(savedCode, uid);
    setScreen('lobby');
  }, [isAuthReady, uid, rejoinAttempted, subscribeToRoom, setScreen]);

  // Keep the saved room reference "fresh" while actively in a room, so a
  // long lobby/match session doesn't have its rejoin-eligibility expire
  // (see MAX_AGE_MS in sessionPersistence.ts) while still in use.
  useEffect(() => {
    if (screen !== 'lobby' && screen !== 'match') return;
    touchActiveRoom();
    const interval = setInterval(touchActiveRoom, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [screen]);

  // If we're in the lobby but the subscribed room turns out not to exist
  // (e.g. it was cleaned up while we were away), clear stale session
  // state so the player isn't stuck on a loading lobby forever.
  useEffect(() => {
    if (screen !== 'lobby') return;
    if (room === null) {
      const { loading } = useRoomStore.getState();
      if (!loading) {
        clearActiveRoom();
      }
    }
  }, [screen, room]);

  // Cross-player screen routing driven by `rooms/{code}.status`:
  // - 'lobby' -> 'lobby' screen (also handles returning from post-game,
  //   for ALL players once the host calls returnToLobby).
  // - 'starting' / 'match' -> subscribe to the game (if not already) and
  //   show the 'match' screen.
  // Only acts while the player is in one of the room-bound screens, so
  // it doesn't interfere with home/lobby-setup navigation.
  useEffect(() => {
    if (!room || !uid) return;
    if (screen !== 'lobby' && screen !== 'match' && screen !== 'post_game') return;

    if (room.status === 'lobby') {
      if (screen !== 'lobby') {
        useGameStore.getState().unsubscribeFromGame();
        setScreen('lobby');
      }
      return;
    }

    if (room.status === 'starting' || room.status === 'match') {
      const { gameId, subscribeToGame } = useGameStore.getState();
      if (gameId !== room.code) {
        subscribeToGame(room.code, uid);
      }
      if (screen !== 'match' && screen !== 'post_game') {
        setScreen('match');
      }
    }
  }, [room, uid, screen, setScreen]);

  // Within the match, once the subscribed game reports `status ===
  // 'ended'`, move everyone to the post-game screen. Watches the game
  // store directly (rather than via a selector prop) so this works even
  // if MatchScreen itself doesn't re-render for some reason.
  const gameStatus = useGameStore((s) => s.game?.status);
  useEffect(() => {
    if (screen !== 'match') return;
    if (gameStatus === 'ended') {
      setScreen('post_game');
    }
  }, [screen, gameStatus, setScreen]);

  if (!isAuthReady || !uid) {
    if (authTimedOut) {
      return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-ink-950 px-6 text-center safe-area-screen">
          <p className="text-sm text-white/60">
            Taking longer than usual to connect.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="tap-target rounded-xl2 bg-signal px-6 py-3 font-display text-sm font-semibold text-ink-950 active:scale-95"
          >
            Retry
          </button>
        </div>
      );
    }
    return <LoadingScreen message="Connecting…" />;
  }

  return (
    <div className="relative h-full w-full safe-area-screen">
      <ConnectionBanner />
      {screen === 'home' && <HomeScreen />}
      {screen === 'create_room' && <CreateRoomScreen />}
      {screen === 'join_room' && <JoinRoomScreen />}
      {screen === 'practice_setup' && <PracticeSetupScreen />}
      {screen === 'tutorial' && <TutorialScreen language={tutorialLanguage} />}
      {screen === 'settings' && <PlaceholderScreen name="Settings" />}
      {screen === 'lobby' && <LobbyScreen />}
      {screen === 'match' && <MatchScreen />}
      {screen === 'post_game' && <PostGameScreen />}
      <Toast />
      {import.meta.env.DEV && <DevPanel />}
    </div>
  );
}
