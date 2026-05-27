import { db, UserGame } from "../../";

export type InsertUserGameProps = {
  userId: string;
  gameCode: string;
};

export const insertUserGame = async ({
  userId,
  gameCode,
}: InsertUserGameProps) => {
  const [userGame] = await db
    .insert(UserGame)
    .values({ userId, gameCode })
    .onConflictDoNothing()
    .returning();

  return userGame;
};
