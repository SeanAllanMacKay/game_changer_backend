import { pgTable, uuid, timestamp, jsonb } from "drizzle-orm/pg-core";
import { GameRoundActionConfig } from "./GameRoundActionConfig";
import { GameRoundActionType } from "./GameRoundActionType";
import { GameRound } from "./GameRound";
import type { ActionInput } from "../inputSchema";

/**
 * A single action instance within a round
 */
export const GameRoundAction = pgTable("GameRoundAction", {
  id: uuid().defaultRandom().unique().primaryKey(),
  configId: uuid()
    .references(() => GameRoundActionConfig.id)
    .notNull(),
  actionTypeId: uuid()
    .references(() => GameRoundActionType.id)
    .notNull(),
  roundId: uuid()
    .references(() => GameRound.id)
    .notNull(),
  // Snapshot of `GameRoundActionConfig.inputSchema` at action-creation time.
  // Persisted so later edits to the config don't retroactively invalidate
  // submissions against this action.
  inputSchema: jsonb().$type<ActionInput>(),
  input: jsonb(),
  output: jsonb(),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp()
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});
