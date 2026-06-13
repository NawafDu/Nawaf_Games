import { getMinigame } from '@/lib/minigames/registry';
import type { PlayerTask } from '@/types';

interface TaskPanelProps {
  tasks: PlayerTask[];
  currentNodeId: string;
  onLaunchTask: (task: PlayerTask) => void;
}

const LENGTH_LABEL: Record<PlayerTask['length'], string> = {
  short: 'Quick',
  medium: 'Standard',
  long: 'Extended',
};

/**
 * Shows the player's full task list (grouped by status) and highlights
 * any task(s) located at the player's current node with a "Start" button
 * that opens the corresponding minigame.
 */
export default function TaskPanel({ tasks, currentNodeId, onLaunchTask }: TaskPanelProps) {
  const completed = tasks.filter((t) => t.status === 'completed');
  const pending = tasks.filter((t) => t.status !== 'completed');
  const here = pending.filter((t) => t.nodeId === currentNodeId);
  const elsewhere = pending.filter((t) => t.nodeId !== currentNodeId);

  return (
    <div className="bg-ink-900 border border-ink-700 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm text-white/90">Your Tasks</h3>
        <span className="text-xs text-white/50 tabular-nums">
          {completed.length} / {tasks.length} complete
        </span>
      </div>

      {here.length > 0 && (
        <div className="space-y-2">
          {here.map((task) => {
            const minigame = getMinigame(task.minigameId);
            return (
              <button
                key={task.id}
                type="button"
                onClick={() => onLaunchTask(task)}
                className="w-full flex items-center justify-between gap-3 bg-signal/10 border border-signal/40 rounded-xl px-3 py-3 active:bg-signal/20 transition-colors min-h-[44px]"
              >
                <div className="text-left">
                  <div className="text-sm font-medium text-white">{minigame.name}</div>
                  <div className="text-xs text-white/50">{minigame.description}</div>
                </div>
                <span className="text-xs font-medium text-signal shrink-0">Start</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="space-y-1.5">
        {elsewhere.map((task) => {
          const minigame = getMinigame(task.minigameId);
          return (
            <div key={task.id} className="flex items-center justify-between text-xs text-white/50 px-1">
              <span>{minigame.name}</span>
              <span className="flex items-center gap-2">
                <span className="text-white/30">{LENGTH_LABEL[task.length]}</span>
                <span>{task.progress > 0 ? `${task.progress}%` : '—'}</span>
              </span>
            </div>
          );
        })}

        {completed.map((task) => {
          const minigame = getMinigame(task.minigameId);
          return (
            <div key={task.id} className="flex items-center justify-between text-xs text-white/30 px-1 line-through">
              <span>{minigame.name}</span>
              <span>Done</span>
            </div>
          );
        })}
      </div>

      {tasks.length === 0 && <p className="text-xs text-white/40">No tasks assigned.</p>}
    </div>
  );
}
