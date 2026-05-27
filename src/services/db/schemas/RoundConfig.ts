import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  pgEnum,
} from "drizzle-orm/pg-core";
import { GameConfig } from "./GameConfig";

// Drives `viewState.phase` on the API: lets the FE pick a top-level route
// (/lobby, /setup, /play, /results) without inspecting nested round/action state.
export const roundPhaseEnum = pgEnum("RoundPhase", [
  "SETUP",
  "PLAY",
  "RESULTS",
]);

/**
 * The definition of a single round-shape within a game.
 * `order` defines the sequence within the game; `repeatCount` is how many
 * round instances are spawned from this template. When `repeatPerPlayer` is
 * true, the actual round count is `repeatCount * playerCount` (resolved when
 * the Game instance is created).
 */
export const RoundConfig = pgTable("RoundConfig", {
  id: uuid().defaultRandom().unique().primaryKey(),
  gameConfigId: uuid()
    .references(() => GameConfig.id)
    .notNull(),
  order: integer().notNull(),
  repeatCount: integer().default(1).notNull(),
  repeatPerPlayer: boolean().default(false).notNull(),
  phase: roundPhaseEnum().default("PLAY").notNull(),
  name: text(),
  description: text(),
});
