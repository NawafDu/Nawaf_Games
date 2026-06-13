import type { GameState, WinningTeam } from '@/types';

/**
 * Evaluates whether either team has met its win condition, per the
 * rules:
 * - Citizens win if every Citizen has completed every task on their
 *   list, OR every Saboteur has been eliminated/ejected (no living
 *   Saboteurs remain).
 * - Saboteurs win if the number of living Saboteurs is >= the number of
 *   living Citizens (and there is at least one living Saboteur — an
 *   empty room shouldn't trigger a Saboteur win).
 *
 * Returns null if neither condition is met yet.
 */
export function checkWinConditions(game: GameState): WinningTeam {
  const players = Object.values(game.players);

  const livingCitizens = players.filter((p) => p.alive && p.role === 'citizen');
  const livingSaboteurs = players.filter((p) => p.alive && p.role === 'saboteur');

  // Saboteur win: parity or majority, as long as at least one saboteur
  // remains (avoids a degenerate "0 >= 0" win if everyone is gone).
  if (livingSaboteurs.length > 0 && livingSaboteurs.length >= livingCitizens.length) {
    return 'saboteurs';
  }

  // Citizen win condition A: all saboteurs eliminated/ejected.
  const allSaboteurs = players.filter((p) => p.role === 'saboteur');
  if (allSaboteurs.length > 0 && allSaboteurs.every((p) => !p.alive)) {
    return 'citizens';
  }

  // Citizen win condition B: every living citizen has completed every task.
  // (Eliminated/ejected citizens' incomplete tasks don't block the win —
  // they're out of the round.)
  if (livingCitizens.length > 0) {
    const allTasksDone = livingCitizens.every((p) => p.tasks.every((t) => t.status === 'completed'));
    if (allTasksDone) {
      return 'citizens';
    }
  }

  return null;
}
