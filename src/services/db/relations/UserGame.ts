import { relations } from "drizzle-orm";
import { Game, User, UserGame } from "../schemas";

export const UserGameRelations = relations(UserGame, ({ one, many }) => ({
  user: one(User, {
    fields: [UserGame.userId],
    references: [User.id],
    relationName: "user_to_userGame",
  }),
  game: one(Game, {
    fields: [UserGame.gameCode],
    references: [Game.gameCode],
    relationName: "game_to_userGame",
  }),
}));
