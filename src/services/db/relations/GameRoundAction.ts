import { relations } from "drizzle-orm";
import {
  GameRound,
  GameRoundAction,
  GameRoundActionConfig,
  GameRoundActionType,
  GameRoundSubmission,
} from "../schemas";

export const GameRoundActionRelations = relations(
  GameRoundAction,
  ({ one, many }) => ({
    config: one(GameRoundActionConfig, {
      fields: [GameRoundAction.configId],
      references: [GameRoundActionConfig.id],
    }),
    actionType: one(GameRoundActionType, {
      fields: [GameRoundAction.actionTypeId],
      references: [GameRoundActionType.id],
    }),
    round: one(GameRound, {
      fields: [GameRoundAction.roundId],
      references: [GameRound.id],
    }),
    submissions: many(GameRoundSubmission),
  }),
);
