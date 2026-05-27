import { eq, count, and } from "drizzle-orm";

import { db, UserGame } from "../../";

export type SelectProjectsProps = {
  userId: string;
  page?: number;
  pageSize?: number;
};

export const selectUserGames = async ({
  userId,
  page = 1,
  pageSize = 15,
}: SelectProjectsProps) => {
  const [{ totalItems }] = await db
    .selectDistinct({ totalItems: count() })
    .from(UserGame)
    .where(eq(UserGame.userId, userId));

  const projects = await db.query.Game.findMany({
    where: (game, { exists }) =>
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
    with: {
      config: true,
      players: {
        with: {
          user: { columns: { id: true, name: true } },
        },
      },
    },
    orderBy: (projects, { desc }) => desc(projects.createdAt),
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  return {
    projects,
    totalItems,
    totalPages: Math.ceil(totalItems / pageSize),
  };
};
