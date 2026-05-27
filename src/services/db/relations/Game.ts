import { relations } from "drizzle-orm";
import {
  Game,
  GameConfig,
  GameRound,
  GameWinner,
  User,
  UserGame,
} from "../schemas";

export const GameRelations = relations(Game, ({ one, many }) => ({
  config: one(GameConfig, {
    fields: [Game.configId],
    references: [GameConfig.id],
  }),
  winners: many(GameWinner),
  rounds: many(GameRound),
  players: many(UserGame, { relationName: "game_to_userGame" }),
  owner: one(User, {
    fields: [Game.ownerId],
    references: [User.id],
  }),
}));
