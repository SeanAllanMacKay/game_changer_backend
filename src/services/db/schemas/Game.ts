import { pgTable, uuid, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { GameConfig } from "./GameConfig";
import { User } from "./User";

const GAME_CODE_LENGTH = 6;
const GAME_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ";

function createGameCode() {
  let result = "";
  for (let i = 0; i < GAME_CODE_LENGTH; i++) {
    result += GAME_CODE_ALPHABET.charAt(
      Math.floor(Math.random() * GAME_CODE_ALPHABET.length),
    );
  }
  return result;
}

export const gameStatusEnum = pgEnum("GameStatus", [
  "WAITING",
  "IN_PROGRESS",
  "PAUSED",
  "COMPLETED",
  "ABANDONED",
]);

/**
 * An instance of a game, not the definition of one
 */
export const Game = pgTable("Game", {
  gameCode: text().$defaultFn(createGameCode).unique().primaryKey(),
  configId: uuid()
    .references(() => GameConfig.id)
    .notNull(),
  status: gameStatusEnum().default("WAITING").notNull(),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp()
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  ownerId: uuid()
    .references(() => User.id)
    .notNull(),
});
