import { eq, and } from "drizzle-orm";

import { db, UserGame } from "../../";
import { getActionHandler } from "../../../../games";

export type SelectGameProps = {
  userId?: string;
  gameCode: string;
};

export const selectGame = async ({ userId, gameCode }: SelectGameProps) => {
  const game = await db.query.Game.findFirst({
    where: (game, { exists }) =>
      userId
        ? and(
            eq(game.gameCode, gameCode),
            exists(
              db
                .select()
                .from(UserGame)
                .where(
                  and(
                    eq(UserGame.gameCode, game.gameCode),
                    eq(UserGame.userId, userId),
                  ),
                ),
            ),
          )
        : eq(game.gameCode, gameCode),
    with: {
      config: {
        with: {
          roundConfigs: true,
        },
      },
      winners: {
        with: {
          user: { columns: { id: true, name: true } },
        },
      },
      rounds: {
        with: {
          roundConfig: { columns: { phase: true } },
          actions: {
            with: {
              config: {
                columns: { order: true, description: true },
                with: {
                  actionType: { columns: { name: true, role: true } },
                },
              },
              // Payload + createdAt come back full; we strip them
              // post-query for any action whose handler doesn't opt into
              // `publicSubmissions`. This keeps Dirty Laundry's truths and
              // votes private while letting AUCTION_BID expose the live
              // bid history.
              submissions: {
                columns: { userId: true, payload: true, createdAt: true },
              },
            },
          },
        },
      },
      players: {
        with: {
          user: { columns: { id: true, name: true } },
        },
      },
    },
  });

  if (!game) return game;

  for (const round of game.rounds) {
    for (const action of round.actions) {
      const handler = getActionHandler(
        game.config.name,
        action.config.actionType.name,
      );
      if (handler?.publicSubmissions) continue;
      action.submissions = action.submissions.map((s) => ({
        userId: s.userId,
        payload: null as unknown as (typeof s)["payload"],
        createdAt: null as unknown as (typeof s)["createdAt"],
      }));
    }
  }

  return game;
};
