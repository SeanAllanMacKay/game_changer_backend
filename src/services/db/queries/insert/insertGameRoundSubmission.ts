import { db, GameRoundSubmission } from "../../";
import type { SubmissionPayload } from "../../inputSchema";

export type InsertGameRoundSubmissionProps = {
  userId: string;
  roundId: string;
  actionId: string;
  payload: SubmissionPayload;
};

export const insertGameRoundSubmission = async ({
  userId,
  roundId,
  actionId,
  payload,
}: InsertGameRoundSubmissionProps) => {
  const [submission] = await db
    .insert(GameRoundSubmission)
    .values({ userId, roundId, actionId, payload })
    .returning();

  return submission;
};
