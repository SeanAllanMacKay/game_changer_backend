import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import {
  db,
  insertGameWinners,
  markActionOutput,
  selectGame,
  UserGame,
} from "../../services/db";
import { GAME_EVENTS, gameChannel, realtime } from "../../services/realtime";
import { advanceRoundIfComplete } from "./advanceRoundIfComplete";

const propsSchema = z.object({
  gameCode: z.string().min(1),
  roundId: z.string().min(1).uuid(),
});

type RunArgs = z.infer<typeof propsSchema>;

/**
 * SYSTEM action for the final RESULTS round. Picks every player tied at the
 * highest score and writes `{ completedAt, winnerIds }` to the DECLARE_WINNER
 * action's `output`, which lets `advanceRoundIfComplete` finalise the game as
 * COMPLETED without the FE having to ack a "finish game" step. Idempotent: a
 * concurrent caller that loses the `markActionOutput` race exits without side
 * effects.
 */
export const runDeclareWinnerIfReady = async ({
  gameCode,
  roundId,
}: RunArgs): Promise<void> => {
  propsSchema.parse({ gameCode, roundId });

  const round = await db.query.GameRound.findFirst({
    where: (r, { eq }) => eq(r.id, roundId),
    with: {
      actions: {
        with: {
          config: { columns: { order: true } },
          actionType: { columns: { name: true } },
        },
      },
    },
  });
  if (!round) return;
  if (round.status !== "IN_PROGRESS") return;

  const declare = round.actions.find(
    (a) => a.actionType.name === "DECLARE_WINNER",
  );
  if (!declare || declare.output !== null) return;

  const standings = await db
    .select({ userId: UserGame.userId, points: UserGame.points })
    .from(UserGame)
    .where(eq(UserGame.gameCode, gameCode))
    .orderBy(desc(UserGame.points));

  const topPoints = standings[0]?.points ?? null;
  const winnerIds =
    topPoints === null
      ? []
      : standings.filter((s) => s.points === topPoints).map((s) => s.userId);

  const claimed = await markActionOutput({
    actionId: declare.id,
    output: {
      completedAt: new Date().toISOString(),
      winnerIds,
    },
  });
  if (!claimed) return;

  await insertGameWinners({ gameCode, userIds: winnerIds });

  const updatedGame = await selectGame({ gameCode });
  realtime.publish(gameChannel(gameCode), GAME_EVENTS.ACTION_ADVANCED, {
    gameCode,
    game: updatedGame,
  });

  await advanceRoundIfComplete({ gameCode, roundId });
};
