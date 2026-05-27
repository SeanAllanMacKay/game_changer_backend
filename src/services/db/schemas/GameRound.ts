import {
  pgTable,
  uuid,
  timestamp,
  text,
  integer,
  pgEnum,
} from "drizzle-orm/pg-core";
import { User } from "./User";
import { Game } from "./Game";
import { RoundConfig } from "./RoundConfig";

export const gameRoundStatusEnum = pgEnum("GameRoundStatus", [
  "PENDING",
  "IN_PROGRESS",
  "COMPLETED",
]);

export const mediaTypeEnum = pgEnum("MediaType", ["IMAGE", "VIDEO", "AUDIO"]);

/**
 * A single round of a game instance
 */
export const GameRound = pgTable("GameRound", {
  id: uuid().defaultRandom().unique().primaryKey(),
  gameCode: text()
    .references(() => Game.gameCode)
    .notNull(),
  roundConfigId: uuid()
    .references(() => RoundConfig.id)
    .notNull(),
  order: integer().notNull(),
  status: gameRoundStatusEnum().default("PENDING").notNull(),
  activePlayerId: uuid().references(() => User.id),
  promptText: text(),
  promptMediaUrl: text(),
  promptMediaType: mediaTypeEnum(),
  winnerId: uuid().references(() => User.id),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp()
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});
