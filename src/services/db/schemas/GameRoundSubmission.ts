import { pgTable, uuid, timestamp, jsonb } from "drizzle-orm/pg-core";
import { User } from "./User";
import { GameRound } from "./GameRound";
import { GameRoundAction } from "./GameRoundAction";
import type { SubmissionPayload } from "../inputSchema";

/**
 * A user submission for a given action of a round. The payload's shape is
 * driven by the action's `GameRoundActionConfig.inputSchema` and validated
 * against `SubmissionPayloadSchema` at submit time. Uniqueness per
 * (user, action) is enforced at the application level via the per-action
 * handler registry — action types that opt into `allowMultipleSubmissions`
 * (e.g. AUCTION_BID) can have many submissions per user.
 */
export const GameRoundSubmission = pgTable("GameRoundSubmission", {
  id: uuid().defaultRandom().unique().primaryKey(),
  userId: uuid()
    .references(() => User.id)
    .notNull(),
  roundId: uuid()
    .references(() => GameRound.id)
    .notNull(),
  actionId: uuid()
    .references(() => GameRoundAction.id)
    .notNull(),
  payload: jsonb().$type<SubmissionPayload>().notNull(),
  createdAt: timestamp().defaultNow().notNull(),
});
