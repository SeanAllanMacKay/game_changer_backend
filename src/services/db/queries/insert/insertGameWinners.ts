import { db, GameWinner } from "../../";

export type InsertGameWinnersProps = {
  gameCode: string;
  userIds: string[];
};

export const insertGameWinners = async ({
  gameCode,
  userIds,
}: InsertGameWinnersProps) => {
  if (userIds.length === 0) return [];

  return await db
    .insert(GameWinner)
    .values(userIds.map((userId) => ({ gameCode, userId })))
    .onConflictDoNothing()
    .returning();
};
