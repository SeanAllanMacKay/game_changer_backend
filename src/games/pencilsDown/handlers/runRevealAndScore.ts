import { and, eq, sql } from "drizzle-orm";

import {
  db,
  markActionOutput,
  selectGame,
  UserGame,
} from "../../../services/db";
import { GAME_EVENTS, gameChannel, realtime } from "../../../services/realtime";
import { advanceRoundIfComplete } from "../../../actions/game/advanceRoundIfComplete";
import { shuffleSubmissions } from "../shuffle";

type RunArgs = {
  gameCode: string;
  roundId: string;
};

/**
 * SYSTEM step that reveals the winning drawing's author, awards 1 point,
 * and advances the round. Re-derives the full slot → userId mapping (from
 * `(roundId, DRAWING_SUBMISSION.submissions)`) and writes it to
 * REVEAL_AND_SCORE's `output.authorBySlot` so the FE can render the
 * reveal — labelling every drawing with its author, not just the winner.
 *
 * Called explicitly from `runHostSelectWinner`; also registered as
 * REVEAL_AND_SCORE's `onSystemAdvance` in the handler map for symmetry.
 * Idempotent: CAS on `markActionOutput` prevents double-awards.
 */
export const runRevealAndScore = async ({
  gameCode,
  roundId,
}: RunArgs): Promise<void> => {
  const round = await db.query.GameRound.findFirst({
    where: (r, { eq }) => eq(r.id, roundId),
    with: {
      actions: {
        with: {
          actionType: { columns: { name: true } },
          submissions: {
            columns: { userId: true, payload: true, createdAt: true },
          },
        },
      },
    },
  });
  if (!round) return;
  if (round.status !== "IN_PROGRESS") return;

  const reveal = round.actions.find(
    (a) => a.actionType.name === "REVEAL_AND_SCORE",
  );
  const drawing = round.actions.find(
    (a) => a.actionType.name === "DRAWING_SUBMISSION",
  );
  const select = round.actions.find(
    (a) => a.actionType.name === "HOST_SELECT_WINNER",
  );
  if (!reveal || !drawing || !select) return;
  if (reveal.output !== null) return;

  const winnerUserId = round.winnerId;
  if (!winnerUserId) return;

  const mapping = shuffleSubmissions(drawing.submissions, roundId);
  const winningSlot = mapping.find((s) => s.userId === winnerUserId);
  if (!winningSlot) return;

  const authorBySlot = mapping.map((s) => ({
    slotId: s.slotId,
    userId: s.userId,
  }));

  const claimed = await markActionOutput({
    actionId: reveal.id,
    output: {
      completedAt: new Date().toISOString(),
      winnerUserId,
      winningSlotId: winningSlot.slotId,
      authorBySlot,
      points: 1,
    },
  });
  if (!claimed) return;

  await db
    .update(UserGame)
    .set({ points: sql`${UserGame.points} + 1` })
    .where(
      and(eq(UserGame.userId, winnerUserId), eq(UserGame.gameCode, gameCode)),
    );

  const updatedGame = await selectGame({ gameCode });
  realtime.publish(gameChannel(gameCode), GAME_EVENTS.ACTION_ADVANCED, {
    gameCode,
    game: updatedGame,
  });

  await advanceRoundIfComplete({ gameCode, roundId });
};
