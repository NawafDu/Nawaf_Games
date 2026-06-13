// Characters chosen to avoid visually ambiguous pairs (0/O, 1/I/L) for
// easier reading/typing on a phone keyboard.
const ROOM_CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generateRoomCode(length = 6): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
  }
  return code;
}

export function normalizeRoomCode(input: string): string {
  return input.trim().toUpperCase();
}

export function isValidRoomCode(input: string): boolean {
  return /^[A-Z0-9]{6}$/.test(normalizeRoomCode(input));
}

/**
 * Generates a unique push-style ID, suitable for event log entries,
 * task IDs, message IDs, etc. Not cryptographically secure — fine for
 * non-sensitive client-generated identifiers.
 */
export function generateId(prefix = ''): string {
  const rand = Math.random().toString(36).slice(2, 10);
  const time = Date.now().toString(36);
  return `${prefix}${time}${rand}`;
}

/**
 * Given a desired base display name and the set of existing display
 * names already in a room, returns a unique display name. If the base
 * name is already taken, appends "#NN" with a random two-digit suffix,
 * retrying until unique.
 *
 * Example: "Nawaf" -> "Nawaf" (if free) or "Nawaf#42" (if taken).
 */
export function makeUniqueDisplayName(
  baseName: string,
  existingNames: Iterable<string>
): string {
  const taken = new Set(existingNames);
  const trimmed = baseName.trim().slice(0, 16) || 'Player';

  if (!taken.has(trimmed)) {
    return trimmed;
  }

  // Try random two-digit suffixes first; fall back to sequential search
  // if we get unlucky with collisions.
  for (let attempt = 0; attempt < 25; attempt++) {
    const suffix = Math.floor(Math.random() * 100)
      .toString()
      .padStart(2, '0');
    const candidate = `${trimmed}#${suffix}`;
    if (!taken.has(candidate)) {
      return candidate;
    }
  }

  for (let n = 1; n < 1000; n++) {
    const candidate = `${trimmed}#${n}`;
    if (!taken.has(candidate)) {
      return candidate;
    }
  }

  // Extremely unlikely fallback.
  return `${trimmed}#${generateId()}`;
}
