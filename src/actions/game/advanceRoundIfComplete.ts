import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";

import {
  db,
  Game,
  GameRound,
  UserGame,
  insertGameWinners,
  markRoundStatus,
  selectGame,
  selectNextPendingRound,
} from "../../services/db";
import { GAME_EVENTS, gameChannel, realtime } from "../../services/realtime";
import { dispatchFirstSystemAction } from "../../games";

const propsSchema = z.object({
  gameCode: z.string().min(1),
  roundId: z.string().min(1).uuid(),
});

export type AdvanceRoundIfCompleteProps = z.infer<typeof propsSchema>;

export const advanceRoundIfComplete = async (
  props: AdvanceRoundIfCompleteProps,
): Promise<{ advanced: boolean }> => {
  try {
    const { gameCode, roundId } = propsSchema.parse(props);

    const round = await db.query.GameRound.findFirst({
      where: eq(GameRound.id, roundId),
      with: { actions: true },
    });
    if (!round) return { advanced: false };

    if (round.actions.some((a) => a.output === null)) {
      return { advanced: false };
    }

    const completed = await markRoundStatus({
      roundId,
      fromStatus: "IN_PROGRESS",
      toStatus: "COMPLETED",
    });
    if (!completed) return { advanced: false };

    const nextRound = await selectNextPendingRound({
      gameCode,
      afterOrder: round.order,
    });
    if (!nextRound) {
      const standings = await db
        .select({ userId: UserGame.userId, points: UserGame.points })
        .from(UserGame)
        .where(eq(UserGame.gameCode, gameCode))
        .orderBy(desc(UserGame.points));

      const topPoints = standings[0]?.points ?? null;
      const winnerIds =
        topPoints === null
          ? []
          : standings
              .filter((s) => s.points === topPoints)
              .map((s) => s.userId);

      await db
        .update(Game)
        .set({ status: "COMPLETED" })
        .where(and(eq(Game.gameCode, gameCode), eq(Game.status, "IN_PROGRESS")));

      await insertGameWinners({ gameCode, userIds: winnerIds });

      const updatedGame = await selectGame({ gameCode });
      realtime.publish(gameChannel(gameCode), GAME_EVENTS.ROUND_ADVANCED, {
        gameCode,
        game: updatedGame,
      });

      return { advanced: true };
    }

    await markRoundStatus({
      roundId: nextRound.id,
      fromStatus: "PENDING",
      toStatus: "IN_PROGRESS",
    });

    await dispatchFirstSystemAction({
      gameCode,
      roundId: nextRound.id,
    });

    const updatedGame = await selectGame({ gameCode });
    realtime.publish(gameChannel(gameCode), GAME_EVENTS.ROUND_ADVANCED, {
      gameCode,
      game: updatedGame,
    });

    return { advanced: true };
  } catch {
    return { advanced: false };
  }
};
