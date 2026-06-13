import { ref, runTransaction, get, set } from 'firebase/database';
import { db } from '@/lib/firebase';
import { generateId } from '@/utils/identifiers';
import { GameActionError } from './movement';
import type { PlayerTask } from '@/types';

/**
 * Marks a task as completed for the given player.
 *
 * `tasks` is an array owned entirely by the player (security rules:
 * `auth.uid === $uid` may write `players/{uid}/tasks`). A transaction
 * scoped to that path handles the read-modify-write atomically — useful
 * if a player somehow triggers completion twice in quick succession
 * (e.g. a slow network retry).
 *
 * Validates the task exists, isn't already completed, and is at the
 * player's current node — the current node is read once beforehand
 * (movement and task-completion are never expected to race for a single
 * player, since both originate from the same client).
 */
export async function completeTask(roomCode: string, uid: string, taskId: string): Promise<void> {
  const playerSnapshot = await get(ref(db, `games/${roomCode}/players/${uid}`));
  const player = playerSnapshot.val();
  if (!player) throw new GameActionError('not_found', 'Player not found.');
  if (!player.alive) throw new GameActionError('not_alive', 'You are not in this match.');

  const gameStatusSnapshot = await get(ref(db, `games/${roomCode}/status`));
  if (gameStatusSnapshot.val() !== 'active') {
    throw new GameActionError('inactive', 'The match has ended.');
  }

  const meetingPhaseSnapshot = await get(ref(db, `games/${roomCode}/meeting/phase`));
  const meetingPhase = meetingPhaseSnapshot.val();
  if (meetingPhase && meetingPhase !== 'closed') {
    throw new GameActionError('meeting_active', 'You cannot do this during a meeting.');
  }

  const currentNodeId = player.movement?.currentNodeId;
  const tasksRef = ref(db, `games/${roomCode}/players/${uid}/tasks`);

  const result = await runTransaction(tasksRef, (tasks: PlayerTask[] | null) => {
    if (!tasks) return tasks;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return; // abort — task not found
    if (task.status === 'completed') return tasks; // idempotent no-op
    if (task.nodeId !== currentNodeId) return; // abort — wrong location

    task.status = 'completed';
    task.progress = 100;
    return tasks;
  });

  if (!result.committed) {
    throw new GameActionError('task_failed', 'Could not complete this task right now.');
  }

  // Best-effort witness event.
  try {
    const eventId = generateId('evt_');
    await set(ref(db, `games/${roomCode}/eventLog/${eventId}`), {
      id: eventId,
      type: 'task_completed',
      actorUid: uid,
      nodeId: currentNodeId,
      timestamp: Date.now(),
      visibilityRadius: 1,
    });
  } catch {
    /* non-critical */
  }
}

/**
 * Updates a task's in-progress percentage (0-100) without marking it
 * complete — used by minigames that report incremental progress.
 * Purely cosmetic; final completion still requires `completeTask`.
 */
export async function updateTaskProgress(roomCode: string, uid: string, taskId: string, progress: number): Promise<void> {
  const tasksRef = ref(db, `games/${roomCode}/players/${uid}/tasks`);

  await runTransaction(tasksRef, (tasks: PlayerTask[] | null) => {
    if (!tasks) return tasks;
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === 'completed') return tasks;

    task.progress = Math.max(0, Math.min(100, progress));
    if (task.status === 'pending' && task.progress > 0) {
      task.status = 'in_progress';
    }
    return tasks;
  });
}
