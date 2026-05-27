import { and, eq } from "drizzle-orm";
import { db, GameRound } from "../../";

export type MarkRoundStatusProps = {
  roundId: string;
  fromStatus: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  toStatus: "PENDING" | "IN_PROGRESS" | "COMPLETED";
};

/**
 * Conditionally transitions `GameRound.status` only when it currently equals
 * `fromStatus`. Returns the updated row, or `undefined` if another writer
 * already claimed the transition. Lets callers run an idempotent
 * "advance the round" step.
 */
export const markRoundStatus = async ({
  roundId,
  fromStatus,
  toStatus,
}: MarkRoundStatusProps) => {
  const [updated] = await db
    .update(GameRound)
    .set({ status: toStatus })
    .where(and(eq(GameRound.id, roundId), eq(GameRound.status, fromStatus)))
    .returning();

  return updated;
};
