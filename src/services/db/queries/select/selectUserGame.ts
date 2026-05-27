import { and, eq } from "drizzle-orm";

import { db, UserGame } from "../../";

export type SelectUserGameProps = {
  userId: string;
  gameCode: string;
};

export const selectUserGame = async ({
  userId,
  gameCode,
}: SelectUserGameProps) => {
  return await db.query.UserGame.findFirst({
    where: and(eq(UserGame.userId, userId), eq(UserGame.gameCode, gameCode)),
  });
};
