import { pgTable, uuid, text, primaryKey } from "drizzle-orm/pg-core";
import { Game } from "./Game";
import { User } from "./User";

export const GameWinner = pgTable(
  "GameWinner",
  {
    gameCode: text()
      .references(() => Game.gameCode)
      .notNull(),
    userId: uuid()
      .references(() => User.id)
      .notNull(),
  },
  (table) => [primaryKey({ columns: [table.gameCode, table.userId] })],
);
