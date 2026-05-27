import { eq } from "drizzle-orm";
import { db, Game } from "../../";

export type UpdateGameProps = {
  gameCode: string;
  status?: (typeof Game.$inferInsert)["status"];
};

export const updateGame = async ({ gameCode, status }: UpdateGameProps) => {
  const [game] = await db
    .update(Game)
    .set({
      ...(status !== undefined ? { status } : {}),
    })
    .where(eq(Game.gameCode, gameCode))
    .returning();

  return game;
};
