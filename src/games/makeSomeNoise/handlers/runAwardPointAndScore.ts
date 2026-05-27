import { and, eq, sql } from "drizzle-orm";

import {
  db,
  markActionOutput,
  selectGame,
  UserGame,
} from "../../../services/db";
import { GAME_EVENTS, gameChannel, realtime } from "../../../services/realtime";
import { advanceRoundIfComplete } from "../../../actions/game/advanceRoundIfComplete";

type RunArgs = {
  gameCode: string;
  roundId: string;
};

/**
 * SYSTEM action: reads `GameRound.winnerId` (set by `runHostSelectWinner`),
 * CAS-marks AWARD_POINT_AND_SCORE's own output, and grants +1 point to the
 * winner in `UserGame.points`. Then calls `advanceRoundIfComplete` to move
 * on to the next round (or to the Final round / DECLARE_WINNER if this was
 * the last gameplay round).
 *
 * Idempotent: the CAS on `markActionOutput` prevents double-awards.
 */
export const runAwardPointAndScore = async ({
  gameCode,
  roundId,
}: RunArgs): Promise<void> => {
  const round = await db.query.GameRound.findFirst({
    where: (r, { eq }) => eq(r.id, roundId),
    with: {
      actions: {
        with: { actionType: { columns: { name: true } } },
      },
    },
  });
  if (!round) return;
  if (round.status !== "IN_PROGRESS") return;

  const award = round.actions.find(
    (a) => a.actionType.name === "AWARD_POINT_AND_SCORE",
  );
  if (!award || award.output !== null) return;

  const winnerId = round.winnerId;
  if (!winnerId) return;

  const claimed = await markActionOutput({
    actionId: award.id,
    output: {
      completedAt: new Date().toISOString(),
      winnerId,
      points: 1,
    },
  });
  if (!claimed) return;

  await db
    .update(UserGame)
    .set({ points: sql`${UserGame.points} + 1` })
    .where(and(eq(UserGame.userId, winnerId), eq(UserGame.gameCode, gameCode)));

  const updatedGame = await selectGame({ gameCode });
  realtime.publish(gameChannel(gameCode), GAME_EVENTS.ACTION_ADVANCED, {
    gameCode,
    game: updatedGame,
  });

  await advanceRoundIfComplete({ gameCode, roundId });
};
