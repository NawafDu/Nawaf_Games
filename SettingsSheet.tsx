import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/common/Button';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { updateRoomSettings } from '@/lib/roomService';
import { saboteurRange, type RoomSettings, type MovementSpeed, type VisibilityLevel, type BotDifficulty } from '@/types';

interface SettingsSheetProps {
  roomCode: string;
  settings: RoomSettings;
  onClose: () => void;
}

const MOVEMENT_OPTIONS: { id: MovementSpeed; label: string }[] = [
  { id: 'very_slow', label: 'Very Slow' },
  { id: 'slow', label: 'Slow' },
  { id: 'normal', label: 'Normal' },
  { id: 'fast', label: 'Fast' },
];

const VISIBILITY_OPTIONS: { id: VisibilityLevel; label: string }[] = [
  { id: 'low', label: 'Low' },
  { id: 'medium', label: 'Medium' },
  { id: 'high', label: 'High' },
];

const BOT_DIFFICULTY_OPTIONS: { id: BotDifficulty; label: string }[] = [
  { id: 'easy', label: 'Easy' },
  { id: 'medium', label: 'Medium' },
  { id: 'hard', label: 'Hard' },
];

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-1.5">
      {options.map((opt) => (
        <button
          key={opt.id}
          onClick={() => onChange(opt.id)}
          className={`tap-target flex-1 rounded-xl2 py-2.5 text-xs font-semibold transition ${
            value === opt.id ? 'bg-signal text-ink-950' : 'bg-ink-800 text-white/60'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function Stepper({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-sm text-white/70">{label}</span>
      <div className="flex items-center gap-3">
        <button
          onClick={() => onChange(Math.max(min, value - step))}
          className="tap-target flex h-9 w-9 items-center justify-center rounded-full bg-ink-800 text-lg text-white/70 active:scale-90"
        >
          −
        </button>
        <span className="w-12 text-center font-display text-sm font-semibold text-white">
          {value}{unit}
        </span>
        <button
          onClick={() => onChange(Math.min(max, value + step))}
          className="tap-target flex h-9 w-9 items-center justify-center rounded-full bg-ink-800 text-lg text-white/70 active:scale-90"
        >
          +
        </button>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-white/40 first:mt-0">
      {children}
    </p>
  );
}

export function SettingsSheet({ roomCode, settings, onClose }: SettingsSheetProps) {
  const [local, setLocal] = useState<RoomSettings>(settings);

  const range = saboteurRange(local.maxPlayers);
  const clampedSaboteurs = Math.min(Math.max(local.saboteurCount, range.min), range.max);

  const [handleSave, pending] = useAsyncAction(async () => {
    await updateRoomSettings(roomCode, { ...local, saboteurCount: clampedSaboteurs });
    onClose();
  });

  function update<K extends keyof RoomSettings>(key: K, value: RoomSettings[K]) {
    setLocal((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 z-40 flex items-end bg-black/50"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 280 }}
          onClick={(e) => e.stopPropagation()}
          className="flex w-full flex-col rounded-t-xl2 bg-ink-900 px-4 pt-4 safe-area-screen"
          style={{ maxHeight: '88vh' }}
        >
          <div className="mx-auto mb-1 h-1 w-10 rounded-full bg-white/15" />
          <h2 className="py-2 text-center font-display text-base font-semibold text-white">
            Room Settings
          </h2>

          <div className="flex-1 overflow-y-auto pb-4 no-scrollbar">
            <SectionTitle>Players</SectionTitle>
            <Stepper
              label="Max Players"
              value={local.maxPlayers}
              min={4}
              max={12}
              onChange={(v) => update('maxPlayers', v)}
            />
            <Stepper
              label="Saboteurs"
              value={clampedSaboteurs}
              min={range.min}
              max={range.max}
              onChange={(v) => update('saboteurCount', v)}
            />
            <p className="text-xs text-white/30">
              Allowed range for {local.maxPlayers} players: {range.min}–{range.max}
            </p>

            <SectionTitle>Map</SectionTitle>
            <Stepper
              label="Locations"
              value={local.nodeCount}
              min={6}
              max={12}
              onChange={(v) => update('nodeCount', v)}
            />

            <SectionTitle>Movement Speed</SectionTitle>
            <SegmentedControl
              options={MOVEMENT_OPTIONS}
              value={local.movementSpeed}
              onChange={(v) => update('movementSpeed', v)}
            />

            <SectionTitle>Tasks</SectionTitle>
            <Stepper
              label="Short Tasks"
              value={local.taskCounts.short}
              min={0}
              max={6}
              onChange={(v) => update('taskCounts', { ...local.taskCounts, short: v })}
            />
            <Stepper
              label="Medium Tasks"
              value={local.taskCounts.medium}
              min={0}
              max={6}
              onChange={(v) => update('taskCounts', { ...local.taskCounts, medium: v })}
            />
            <Stepper
              label="Long Tasks"
              value={local.taskCounts.long}
              min={0}
              max={6}
              onChange={(v) => update('taskCounts', { ...local.taskCounts, long: v })}
            />

            <SectionTitle>Cooldowns</SectionTitle>
            <Stepper
              label="Kill Cooldown"
              value={local.killCooldownSec}
              min={10}
              max={60}
              step={5}
              unit="s"
              onChange={(v) => update('killCooldownSec', v)}
            />
            <Stepper
              label="Meeting Cooldown"
              value={local.meetingCooldownSec}
              min={5}
              max={60}
              step={5}
              unit="s"
              onChange={(v) => update('meetingCooldownSec', v)}
            />

            <SectionTitle>Visibility</SectionTitle>
            <p className="mb-1 text-xs text-white/50">Citizen Visibility</p>
            <SegmentedControl
              options={VISIBILITY_OPTIONS}
              value={local.visibility.citizenVisibility}
              onChange={(v) => update('visibility', { ...local.visibility, citizenVisibility: v })}
            />
            <p className="mb-1 mt-3 text-xs text-white/50">Saboteur Visibility</p>
            <SegmentedControl
              options={VISIBILITY_OPTIONS}
              value={local.visibility.saboteurVisibility}
              onChange={(v) => update('visibility', { ...local.visibility, saboteurVisibility: v })}
            />

            <SectionTitle>Meetings & Voting</SectionTitle>
            <Stepper
              label="Discussion Time"
              value={local.discussionDurationSec}
              min={15}
              max={120}
              step={5}
              unit="s"
              onChange={(v) => update('discussionDurationSec', v)}
            />
            <Stepper
              label="Voting Time"
              value={local.votingDurationSec}
              min={10}
              max={60}
              step={5}
              unit="s"
              onChange={(v) => update('votingDurationSec', v)}
            />
            <div className="flex items-center justify-between py-2.5">
              <span className="text-sm text-white/70">Reveal Role on Elimination</span>
              <button
                onClick={() => update('revealRoleOnElimination', !local.revealRoleOnElimination)}
                className={`tap-target rounded-full px-4 py-2 text-xs font-semibold transition ${
                  local.revealRoleOnElimination ? 'bg-signal text-ink-950' : 'bg-ink-800 text-white/60'
                }`}
              >
                {local.revealRoleOnElimination ? 'On' : 'Off'}
              </button>
            </div>

            <SectionTitle>Bots</SectionTitle>
            <SegmentedControl
              options={BOT_DIFFICULTY_OPTIONS}
              value={local.botDifficulty}
              onChange={(v) => update('botDifficulty', v)}
            />
          </div>

          <div className="flex gap-3 pb-4 pt-2">
            <button
              onClick={onClose}
              className="tap-target flex-1 rounded-xl2 border border-white/10 font-display text-sm font-medium text-white/70 active:scale-95"
            >
              Cancel
            </button>
            <Button onClick={handleSave} pending={pending} className="flex-1 py-3.5">
              Save Settings
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
