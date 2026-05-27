import { relations } from "drizzle-orm";
import {
  GameConfig,
  GameRound,
  GameRoundActionConfig,
  RoundConfig,
} from "../schemas";

export const RoundConfigRelations = relations(RoundConfig, ({ one, many }) => ({
  gameConfig: one(GameConfig, {
    fields: [RoundConfig.gameConfigId],
    references: [GameConfig.id],
  }),
  actionConfigs: many(GameRoundActionConfig),
  rounds: many(GameRound),
}));
