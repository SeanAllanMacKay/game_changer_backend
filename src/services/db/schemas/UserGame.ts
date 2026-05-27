import { pgTable, uuid, integer, text, unique } from "drizzle-orm/pg-core";
import { User } from "./User";
import { Game } from "./Game";

export const UserGame = pgTable(
  "UserGame",
  {
    id: uuid().defaultRandom().unique().primaryKey(),
    userId: uuid()
      .references(() => User.id)
      .notNull(),
    gameCode: text()
      .references(() => Game.gameCode)
      .notNull(),
    points: integer().default(0).notNull(),
  },
  (table) => [unique().on(table.userId, table.gameCode)],
);
