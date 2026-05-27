import { relations } from "drizzle-orm";
import {
  GameRoundActionConfig,
  GameRoundActionType,
  RoundConfig,
} from "../schemas";

export const GameRoundActionConfigRelations = relations(
  GameRoundActionConfig,
  ({ one }) => ({
    actionType: one(GameRoundActionType, {
      fields: [GameRoundActionConfig.actionTypeId],
      references: [GameRoundActionType.id],
    }),
    roundConfig: one(RoundConfig, {
      fields: [GameRoundActionConfig.roundConfigId],
      references: [RoundConfig.id],
    }),
  }),
);
