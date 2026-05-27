import { relations } from "drizzle-orm";
import { GameConfig, RoundConfig } from "../schemas";

export const GameConfigRelations = relations(GameConfig, ({ many }) => ({
  roundConfigs: many(RoundConfig),
}));
