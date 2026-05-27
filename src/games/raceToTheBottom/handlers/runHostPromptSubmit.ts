import { and, asc, eq } from "drizzle-orm";

import {
  db,
  GameRound,
  GameRoundSubmission,
  markActionOutput,
  selectGame,
} from "../../../services/db";
import { GAME_EVENTS, gameChannel, realtime } from "../../../services/realtime";
import { extractChallengeText } from "../submissions";

type RunArgs = {
  gameCode: string;
  roundId: string;
  actionId: string;
};

/**
 * Fires after the host submits HOST_PROMPT_SUBMIT. Pulls the host's
 * submission, copies the challenge text onto `GameRound.promptText` so
 * non-host players can see what they're bidding on, and CAS-marks the
 * action's output as completed. Idempotent: a concurrent call that
 * loses the `markActionOutput` race exits without side effects.
 */
export const runHostPromptSubmit = async ({
  gameCode,
  roundId,
  actionId,
}: RunArgs): Promise<void> => {
  const submission = await db
    .select({ payload: GameRoundSubmission.payload })
    .from(GameRoundSubmission)
    .where(
      and(
        eq(GameRoundSubmission.actionId, actionId),
        eq(GameRoundSubmission.roundId, roundId),
      ),
    )
    .orderBy(asc(GameRoundSubmission.createdAt))
    .limit(1);

  if (submission.length === 0) return;

  let challengeText: string;
  try {
    challengeText = extractChallengeText(submission[0].payload);
  } catch {
    return;
  }

  const claimed = await markActionOutput({
    actionId,
    output: { completedAt: new Date().toISOString(), challengeText },
  });
  if (!claimed) return;

  await db
    .update(GameRound)
    .set({ promptText: challengeText })
    .where(eq(GameRound.id, roundId));

  const updatedGame = await selectGame({ gameCode });
  realtime.publish(gameChannel(gameCode), GAME_EVENTS.ACTION_ADVANCED, {
    gameCode,
    game: updatedGame,
  });
};
