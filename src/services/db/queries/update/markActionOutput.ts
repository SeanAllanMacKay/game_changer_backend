import { and, eq, isNull } from "drizzle-orm";
import { db, GameRoundAction } from "../../";

export type MarkActionOutputProps = {
  actionId: string;
  output: unknown;
};

/**
 * Conditionally sets `GameRoundAction.output` only when it is currently NULL.
 * Returns the updated row, or `undefined` if another writer already claimed
 * the transition. Lets callers run an idempotent "advance the action" step.
 */
export const markActionOutput = async ({
  actionId,
  output,
}: MarkActionOutputProps) => {
  const [updated] = await db
    .update(GameRoundAction)
    .set({ output })
    .where(
      and(eq(GameRoundAction.id, actionId), isNull(GameRoundAction.output)),
    )
    .returning();

  return updated;
};
