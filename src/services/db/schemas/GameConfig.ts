import { pgTable, uuid, text, integer } from "drizzle-orm/pg-core";

/**
 * The definition of a game, not an instance of one
 */
export const GameConfig = pgTable("GameConfig", {
  id: uuid().defaultRandom().unique().primaryKey(),
  name: text().notNull(),
  description: text().notNull(),
  maxPlayers: integer(),
  minPlayers: integer(),
  color: text().notNull(),
});
