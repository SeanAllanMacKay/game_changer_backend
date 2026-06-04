/**
 * Deterministic, seeded shuffle keyed by `roundId`. Used by both
 * `runShuffleDrawings` (which writes the shuffled `slotId → drawing` mapping
 * to its action's `output`, exposed to all players) and
 * `runHostSelectWinner` / `runRevealAndScore` (which re-derive the same
 * `slotId → userId` mapping from the private DRAWING_SUBMISSION rows
 * without ever writing it to a column).
 *
 * The mapping isn't persisted anywhere player-visible, so any deterministic
 * function of `(roundId, submissions)` works as long as both callers use the
 * same one. FNV-1a → mulberry32 → Fisher-Yates is overkill for a 10-player
 * party game but keeps the implementation self-contained.
 */

const SLOT_LABELS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

const fnv1a32 = (input: string): number => {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

const mulberry32 = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const seededShuffle = <T,>(items: ReadonlyArray<T>, seed: number): T[] => {
  const result = [...items];
  const rand = mulberry32(seed);
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

export const slotIdFor = (index: number): string => {
  if (index < 0) throw new RangeError(`Slot index must be non-negative: ${index}`);
  if (index < SLOT_LABELS.length) return SLOT_LABELS[index];
  // Two-letter fallback (AA, AB, ...). Min/max players is 3..10, so we
  // need at most 9 slots in practice; this is just defensive.
  const high = Math.floor(index / SLOT_LABELS.length) - 1;
  const low = index % SLOT_LABELS.length;
  return `${SLOT_LABELS[high]}${SLOT_LABELS[low]}`;
};

export type SubmissionForShuffle = {
  userId: string;
  payload: unknown;
  createdAt: Date;
};

export type ShuffledSlot<T = unknown> = {
  slotId: string;
  userId: string;
  payload: T;
};

/**
 * Sorts submissions deterministically (by `createdAt`, with `userId` as a
 * tiebreaker — submissions from the same millisecond are still ordered
 * stably), then shuffles them with a seed derived from `roundId`. Returns
 * `{ slotId, userId, payload }` per drawing, in slot order. Callers decide
 * what to expose (e.g. `runShuffleDrawings` strips `userId` before writing
 * to its action's `output`).
 */
export const shuffleSubmissions = <T = unknown,>(
  submissions: ReadonlyArray<SubmissionForShuffle>,
  roundId: string,
): ShuffledSlot<T>[] => {
  const ordered = [...submissions].sort((a, b) => {
    const t = a.createdAt.getTime() - b.createdAt.getTime();
    if (t !== 0) return t;
    return a.userId.localeCompare(b.userId);
  });
  const shuffled = seededShuffle(ordered, fnv1a32(roundId));
  return shuffled.map((s, i) => ({
    slotId: slotIdFor(i),
    userId: s.userId,
    payload: s.payload as T,
  }));
};
