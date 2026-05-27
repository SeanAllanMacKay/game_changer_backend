import { and, eq, gt } from "drizzle-orm";

import { db, GameRound } from "../../";

export type SelectNextPendingRoundProps = {
  gameCode: string;
  afterOrder: number;
};

export const selectNextPendingRound = async ({
  gameCode,
  afterOrder,
}: SelectNextPendingRoundProps) => {
  return await db.query.GameRound.findFirst({
    where: and(
      eq(GameRound.gameCode, gameCode),
      eq(GameRound.status, "PENDING"),
      gt(GameRound.order, afterOrder),
    ),
    orderBy: (round, { asc }) => [asc(round.order)],
  });
};
