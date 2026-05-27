import { eq } from "drizzle-orm";
import { db, Game } from "../../";

export const selectGameByCode = async ({ gameCode }: { gameCode: string }) => {
  return await db.query.Game.findFirst({
    where: eq(Game.gameCode, gameCode),
  });
};
