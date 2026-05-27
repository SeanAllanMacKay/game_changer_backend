import {
  pgTable,
  uuid,
  integer,
  bigint,
  text,
  jsonb,
} from "drizzle-orm/pg-core";
import { GameRoundActionType } from "./GameRoundActionType";
import { RoundConfig } from "./RoundConfig";
import type { ActionInput } from "../inputSchema";

/**
 * The type of step a round can have
 */
export const GameRoundActionConfig = pgTable("GameRoundActionConfig", {
  id: uuid().defaultRandom().unique().primaryKey(),
  actionTypeId: uuid()
    .references(() => GameRoundActionType.id)
    .notNull(),
  roundConfigId: uuid()
    .references(() => RoundConfig.id)
    .notNull(),
  order: integer().notNull(),
  timer: bigint({ mode: "number" }),
  description: text().notNull(),
  // Per-config prompt used for AI/system interactions (moved off GameRoundActionType)
  prompt: text(),
  // Shape of what a PLAYER action expects; null for SYSTEM/HOST actions.
  // Validated against `ActionInputSchema` in `../inputSchema.ts`.
  inputSchema: jsonb().$type<ActionInput>(),
});
