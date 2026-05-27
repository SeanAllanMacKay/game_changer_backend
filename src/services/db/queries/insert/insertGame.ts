import { db, UserGame, Game } from "../../";

export type InsertGameProps = { userId: string } & Pick<
  typeof Game.$inferInsert,
  "configId"
>;

export const insertGame = async ({ userId, configId }: InsertGameProps) => {
  return await db.transaction(async (transaction) => {
    const config = await db.query.GameConfig.findFirst({
      where: (gameConfig, { eq }) => eq(gameConfig.id, configId),
    });

    if (!config) {
      transaction.rollback();
      throw new Error("Invalid configId");
    }

    const [game] = await transaction
      .insert(Game)
      .values({ configId: config.id, ownerId: userId })
      .returning();

    await transaction
      .insert(UserGame)
      .values({ userId, gameCode: game.gameCode });

    return game;
  });
};
