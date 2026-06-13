import { useUIStore } from '@/store/uiStore';

export function HomeScreen() {
  const setScreen = useUIStore((s) => s.setScreen);
  const setTutorialLanguage = useUIStore((s) => s.setTutorialLanguage);

  function openTutorial(lang: 'en' | 'ar') {
    setTutorialLanguage(lang);
    setScreen('tutorial');
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 px-6 text-center">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-white">
          Shadow Circuit
        </h1>
        <p className="mt-2 text-sm text-white/50">
          A social deduction game for friends.
        </p>
      </div>

      <div className="flex w-full max-w-xs flex-col gap-3">
        <button
          onClick={() => setScreen('create_room')}
          className="tap-target rounded-xl2 bg-signal py-4 font-display text-base font-semibold text-ink-950 active:scale-95"
        >
          Create Room
        </button>
        <button
          onClick={() => setScreen('join_room')}
          className="tap-target rounded-xl2 bg-ink-700 py-4 font-display text-base font-semibold text-white active:scale-95"
        >
          Join Room
        </button>
        <button
          onClick={() => setScreen('practice_setup')}
          className="tap-target rounded-xl2 border border-white/10 py-4 font-display text-sm font-medium text-white/80 active:scale-95"
        >
          Practice with Bots
        </button>

        {/* Tutorial entry points — one per language. Arabic button shows
            its own RTL label so the choice is clear before navigating. */}
        <div className="flex gap-3">
          <button
            onClick={() => openTutorial('en')}
            className="tap-target flex-1 rounded-xl2 border border-white/10 py-4 font-display text-sm font-medium text-white/80 active:scale-95"
          >
            How To Play
          </button>
          <button
            onClick={() => openTutorial('ar')}
            dir="rtl"
            lang="ar"
            className="tap-target flex-1 rounded-xl2 border border-white/10 py-4 font-display text-sm font-medium text-white/80 active:scale-95"
          >
            كيفية اللعب
          </button>
        </div>
      </div>

      <p className="text-xs text-white/30">v0.2 — Phase 2 build</p>
    </div>
  );
}
