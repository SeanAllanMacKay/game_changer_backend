import { relations } from "drizzle-orm";
import {
  Game,
  GameRound,
  GameRoundAction,
  RoundConfig,
  User,
} from "../schemas";

export const GameRoundRelations = relations(GameRound, ({ one, many }) => ({
  game: one(Game, {
    fields: [GameRound.gameCode],
    references: [Game.gameCode],
  }),
  roundConfig: one(RoundConfig, {
    fields: [GameRound.roundConfigId],
    references: [RoundConfig.id],
  }),
  activePlayer: one(User, {
    fields: [GameRound.activePlayerId],
    references: [User.id],
  }),
  winner: one(User, {
    fields: [GameRound.winnerId],
    references: [User.id],
  }),
  actions: many(GameRoundAction),
}));
