import { eq } from "drizzle-orm";

import {
  db,
  markActionOutput,
  selectGame,
  UserGame,
} from "../../../services/db";
import { GAME_EVENTS, gameChannel, realtime } from "../../../services/realtime";
import { runShuffleDrawings } from "./runShuffleDrawings";

type RunArgs = {
  gameCode: string;
  roundId: string;
  actionId: string;
};

/**
 * Called after each DRAWING_SUBMISSION insert. When every non-host player
 * has submitted, CAS-marks the action's `output` and chains into
 * `runShuffleDrawings`. The CAS on `markActionOutput` is what makes this
 * race-safe: concurrent submitters that all pass the count check will only
 * shuffle once.
 *
 * Mirrors `runAiTransformIfReady` / `runVoteTallyIfReady`, but counts
 * against `players.length - 1` instead of `players.length` since the
 * round's host doesn't draw.
 */
export const runDrawingSubmissionIfReady = async ({
  gameCode,
  roundId,
  actionId,
}: RunArgs): Promise<void> => {
  const round = await db.query.GameRound.findFirst({
    where: (r, { eq }) => eq(r.id, roundId),
    columns: { activePlayerId: true, status: true },
    with: {
      actions: {
        with: {
          actionType: { columns: { name: true } },
          submissions: { columns: { userId: true } },
        },
      },
    },
  });
  if (!round) return;
  if (round.status !== "IN_PROGRESS") return;

  const currentAction = round.actions.find((a) => a.id === actionId);
  if (!currentAction) return;
  if (currentAction.actionType.name !== "DRAWING_SUBMISSION") return;
  if (currentAction.output !== null) return;

  const players = await db
    .select({ userId: UserGame.userId })
    .from(UserGame)
    .where(eq(UserGame.gameCode, gameCode));

  const expected = players.length - 1; // every player except the host
  if (currentAction.submissions.length < expected) return;

  const claimed = await markActionOutput({
    actionId: currentAction.id,
    output: {
      completedAt: new Date().toISOString(),
      submissionCount: currentAction.submissions.length,
    },
  });
  if (!claimed) return;

  const updatedGame = await selectGame({ gameCode });
  realtime.publish(gameChannel(gameCode), GAME_EVENTS.ACTION_ADVANCED, {
    gameCode,
    game: updatedGame,
  });

  await runShuffleDrawings({ gameCode, roundId });
};
