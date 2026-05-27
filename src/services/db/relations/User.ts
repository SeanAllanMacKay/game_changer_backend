import { relations } from "drizzle-orm";
import { User, UserGame } from "../schemas";

export const UserRelations = relations(User, ({ many }) => ({
  games: many(UserGame, { relationName: "user_to_userGame" }),
}));
