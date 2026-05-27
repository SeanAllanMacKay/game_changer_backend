import { pgTable, uuid, text, pgEnum } from "drizzle-orm/pg-core";

export const actionRoleEnum = pgEnum("GameRoundActionRole", [
  "SYSTEM",
  "HOST",
  "PLAYER",
]);

/**
 * The type of step a game can have
 */
export const GameRoundActionType = pgTable("GameRoundActionType", {
  id: uuid().defaultRandom().unique().primaryKey(),
  name: text().notNull(),
  description: text().notNull(),
  role: actionRoleEnum().notNull(),
});
