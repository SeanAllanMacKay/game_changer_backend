import {
  db,
  markActionOutput,
  selectGame,
} from "../../../services/db";
import { GAME_EVENTS, gameChannel, realtime } from "../../../services/realtime";
import { tryExtractCompletionConfirmation } from "../submissions";
import { runBidResolveAndScore } from "./runBidResolveAndScore";

type RunArgs = {
  gameCode: string;
  roundId: string;
  actionId: string;
};

/**
 * Fires after the host submits HOST_CONFIRM_COMPLETION. Reads the chosen
 * value from the submission, CAS-writes the action's `output` with the
 * boolean `confirmed` flag, broadcasts `action_advanced`, then defers to
 * `runBidResolveAndScore` which decides whether to award points based on
 * the flag.
 *
 * Idempotent: the CAS in `markActionOutput` makes repeat taps a no-op,
 * and `runBidResolveAndScore` is itself CAS-guarded.
 */
export const runHostConfirmCompletion = async ({
  gameCode,
  roundId,
  actionId,
}: RunArgs): Promise<void> => {
  const action = await db.query.GameRoundAction.findFirst({
    where: (a, { eq }) => eq(a.id, actionId),
    with: {
      submissions: {
        columns: { userId: true, payload: true, createdAt: true },
      },
    },
  });
  if (!action) return;
  if (action.output !== null) return;

  // Only the active host submits this action (validateHostConfirmCompletion)
  // and `allowMultipleSubmissions` isn't set, so there's exactly one row.
  const submission = action.submissions[0];
  if (!submission) return;

  const confirmed = tryExtractCompletionConfirmation(submission.payload);
  if (confirmed === null) return;

  const claimed = await markActionOutput({
    actionId,
    output: {
      completedAt: new Date().toISOString(),
      confirmed,
    },
  });
  if (!claimed) return;

  const updatedGame = await selectGame({ gameCode });
  realtime.publish(gameChannel(gameCode), GAME_EVENTS.ACTION_ADVANCED, {
    gameCode,
    game: updatedGame,
  });

  await runBidResolveAndScore({ gameCode, roundId });
};
