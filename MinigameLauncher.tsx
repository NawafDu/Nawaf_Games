import { useCallback, useEffect, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import MinigameShell from './MinigameShell';
import TapRhythm from './TapRhythm';
import WireMatch from './WireMatch';
import GaugeHold from './GaugeHold';
import MemoryPairs from './MemoryPairs';
import SequenceRecall from './SequenceRecall';
import LogicDials from './LogicDials';
import CircuitRepair from './CircuitRepair';
import CargoSort from './CargoSort';
import ProgressCalibration from './ProgressCalibration';
import { getMinigame } from '@/lib/minigames/registry';
import { completeTask, updateTaskProgress } from '@/lib/gameActions/tasks';
import { withDevLatency } from '@/lib/devtools/devToolsStore';
import type { PlayerTask } from '@/types';

interface MinigameLauncherProps {
  roomCode: string;
  uid: string;
  task: PlayerTask | null;
  onClose: () => void;
}

type MinigameComponent = React.ComponentType<{ onComplete: () => void; onProgress?: (pct: number) => void }>;

const COMPONENT_MAP: Record<string, MinigameComponent> = {
  tap_rhythm: TapRhythm,
  wire_match: WireMatch,
  gauge_hold: GaugeHold,
  memory_pairs: MemoryPairs,
  sequence_recall: SequenceRecall,
  logic_dials: LogicDials,
  circuit_repair: CircuitRepair,
  cargo_sort: CargoSort,
  progress_calibration: ProgressCalibration,
};

/**
 * Renders the appropriate minigame component for `task` inside
 * MinigameShell, wiring its `onComplete`/`onProgress` callbacks to the
 * corresponding task-completion actions. Renders nothing if `task` is
 * null. Used by MatchScreen as `<MinigameLauncher task={activeTask} .../>`
 * where `activeTask` is set by tapping "Start" in TaskPanel.
 */
export default function MinigameLauncher({ roomCode, uid, task, onClose }: MinigameLauncherProps) {
  // Guards against double-completion if a minigame's onComplete fires
  // more than once. Reset whenever a new task is opened.
  const completedRef = useRef(false);

  useEffect(() => {
    completedRef.current = false;
  }, [task?.id]);

  const handleComplete = useCallback(() => {
    if (!task || completedRef.current) return;
    completedRef.current = true;
    withDevLatency(() => completeTask(roomCode, uid, task.id))
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error('[minigame] completeTask failed', err);
      })
      .finally(() => {
        onClose();
      });
  }, [roomCode, uid, task, onClose]);

  const handleProgress = useCallback(
    (pct: number) => {
      if (!task) return;
      updateTaskProgress(roomCode, uid, task.id, pct).catch(() => {
        /* non-critical */
      });
    },
    [roomCode, uid, task]
  );

  if (!task) return null;

  const minigame = getMinigame(task.minigameId);
  const Component = COMPONENT_MAP[task.minigameId];
  if (!Component) return null;

  return (
    <AnimatePresence>
      <MinigameShell key={task.id} title={minigame.name} onClose={onClose}>
        <Component onComplete={handleComplete} onProgress={handleProgress} />
      </MinigameShell>
    </AnimatePresence>
  );
}
