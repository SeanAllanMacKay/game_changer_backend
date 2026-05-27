import { relations } from "drizzle-orm";
import {
  GameRound,
  GameRoundAction,
  GameRoundSubmission,
  User,
} from "../schemas";

export const GameRoundSubmissionRelations = relations(
  GameRoundSubmission,
  ({ one }) => ({
    user: one(User, {
      fields: [GameRoundSubmission.userId],
      references: [User.id],
    }),
    round: one(GameRound, {
      fields: [GameRoundSubmission.roundId],
      references: [GameRound.id],
    }),
    action: one(GameRoundAction, {
      fields: [GameRoundSubmission.actionId],
      references: [GameRoundAction.id],
    }),
  }),
);
