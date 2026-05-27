import { eq } from "drizzle-orm";

import { db, GameRound } from "../../";

export type SelectGameRoundsProps = {
  gameCode: string;
};

export const selectGameRounds = async ({
  gameCode,
}: SelectGameRoundsProps) => {
  return await db.query.GameRound.findMany({
    where: eq(GameRound.gameCode, gameCode),
    orderBy: (round, { asc }) => [asc(round.order)],
    with: {
      actions: true,
    },
  });
};
