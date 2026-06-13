import { useState } from 'react';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { Button } from '@/components/common/Button';
import { Avatar } from '@/components/common/Avatar';
import { AVATAR_PRESETS, COLOR_PRESETS } from '@/lib/presets';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';

interface NameSetupScreenProps {
  /** Where to navigate after confirming — set by whichever flow triggered this screen. */
  onConfirm: () => void;
}

/**
 * Collects (or edits) the player's display name, avatar, and color
 * before creating/joining a room. Values are persisted locally via
 * useAuthStore so returning players don't need to re-enter them.
 */
export function NameSetupScreen({ onConfirm }: NameSetupScreenProps) {
  const setScreen = useUIStore((s) => s.setScreen);
  const {
    preferredName,
    preferredAvatarId,
    preferredColorId,
    setPreferredName,
    setPreferredAvatarId,
    setPreferredColorId,
  } = useAuthStore();

  const [name, setName] = useState(preferredName);
  const [avatarId, setAvatarId] = useState(preferredAvatarId);
  const [colorId, setColorId] = useState(preferredColorId);

  const trimmedName = name.trim();
  const isValid = trimmedName.length >= 1 && trimmedName.length <= 16;

  function handleConfirm() {
    if (!isValid) return;
    setPreferredName(trimmedName);
    setPreferredAvatarId(avatarId);
    setPreferredColorId(colorId);
    onConfirm();
  }

  return (
    <div className="flex h-full flex-col">
      <ScreenHeader title="Your Character" onBack={() => setScreen('home')} />

      <div className="flex-1 overflow-y-auto px-4 pb-4 no-scrollbar">
        {/* Preview */}
        <div className="flex flex-col items-center gap-3 py-6">
          <Avatar avatarId={avatarId} colorId={colorId} size={88} />
          <p className="font-display text-lg font-semibold text-white">
            {trimmedName || 'Player'}
          </p>
        </div>

        {/* Name input */}
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-white/40">
          Display Name
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 16))}
          placeholder="Enter a name"
          maxLength={16}
          autoCapitalize="words"
          autoComplete="off"
          spellCheck={false}
          className="mb-1 w-full rounded-xl2 bg-ink-800 px-4 py-3 text-base text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-signal"
        />
        <p className="mb-6 text-xs text-white/30">
          {trimmedName.length}/16 — if this name is taken in a room, a number
          will be added automatically (e.g. "{trimmedName || 'Name'}#42").
        </p>

        {/* Avatar selection */}
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-white/40">
          Avatar Shape
        </label>
        <div className="mb-6 grid grid-cols-6 gap-2">
          {AVATAR_PRESETS.map((a) => (
            <button
              key={a.id}
              onClick={() => setAvatarId(a.id)}
              className={`tap-target flex items-center justify-center rounded-xl2 p-1 transition ${
                avatarId === a.id ? 'bg-signal/20 ring-2 ring-signal' : 'bg-ink-800'
              }`}
              aria-label={a.label}
            >
              <Avatar avatarId={a.id} colorId={colorId} size={40} />
            </button>
          ))}
        </div>

        {/* Color selection */}
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-white/40">
          Color
        </label>
        <div className="mb-6 grid grid-cols-6 gap-2">
          {COLOR_PRESETS.map((c) => (
            <button
              key={c.id}
              onClick={() => setColorId(c.id)}
              className={`tap-target flex items-center justify-center rounded-xl2 p-2 transition ${
                colorId === c.id ? 'bg-white/10 ring-2 ring-white' : 'bg-ink-800'
              }`}
              aria-label={c.label}
            >
              <span
                className="block h-7 w-7 rounded-full"
                style={{ backgroundColor: c.hex }}
              />
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pb-4">
        <Button onClick={handleConfirm} disabled={!isValid} className="w-full">
          Continue
        </Button>
      </div>
    </div>
  );
}
