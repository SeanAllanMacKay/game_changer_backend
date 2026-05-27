import { relations } from "drizzle-orm";
import { Game, GameWinner, User } from "../schemas";

export const GameWinnerRelations = relations(GameWinner, ({ one }) => ({
  game: one(Game, {
    fields: [GameWinner.gameCode],
    references: [Game.gameCode],
  }),
  user: one(User, {
    fields: [GameWinner.userId],
    references: [User.id],
  }),
}));
