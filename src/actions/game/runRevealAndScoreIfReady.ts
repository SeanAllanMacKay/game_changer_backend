import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { db, markActionOutput, selectGame, UserGame } from "../../services/db";
import { GAME_EVENTS, gameChannel, realtime } from "../../services/realtime";

type RunArgs = {
  gameCode: string;
  roundId: string;
};

const promptSelectOutputSchema = z.object({
  userId: z.string(),
});

const voteTallyOutputSchema = z.object({
  votes: z.array(
    z.object({
      voterUserId: z.string(),
      votedForUserId: z.string(),
    }),
  ),
});

/**
 * SYSTEM action after voting closes. Reads the author from this round's
 * PROMPT_SELECT output and the votes from DELIBERATE_AND_VOTE, computes
 * awards per the Dirty Laundry rules (1 point per correct guess; 3 points
 * to the author if nobody guessed correctly), atomically claims
 * REVEAL_AND_SCORE.output, then applies the increments to `UserGame.points`.
 * Idempotent: only the writer that wins the `markActionOutput` race updates
 * scores; concurrent callers bail.
 */
export const runRevealAndScoreIfReady = async ({
  gameCode,
  roundId,
}: RunArgs): Promise<void> => {
  const round = await db.query.GameRound.findFirst({
    where: (r, { eq }) => eq(r.id, roundId),
    with: {
      actions: {
        with: {
          actionType: { columns: { name: true } },
        },
      },
    },
  });
  if (!round) return;
  if (round.status !== "IN_PROGRESS") return;

  const reveal = round.actions.find(
    (a) => a.actionType.name === "REVEAL_AND_SCORE",
  );
  if (!reveal || reveal.output !== null) return;

  const promptSelect = round.actions.find(
    (a) => a.actionType.name === "PROMPT_SELECT",
  );
  const voteAction = round.actions.find(
    (a) => a.actionType.name === "DELIBERATE_AND_VOTE",
  );
  if (!promptSelect?.output || !voteAction?.output) return;

  const promptParsed = promptSelectOutputSchema.safeParse(promptSelect.output);
  const votesParsed = voteTallyOutputSchema.safeParse(voteAction.output);
  if (!promptParsed.success || !votesParsed.success) return;

  const authorUserId = promptParsed.data.userId;
  const correctVoterUserIds = votesParsed.data.votes
    .filter((v) => v.votedForUserId === authorUserId)
    .map((v) => v.voterUserId);

  const pointsAwarded =
    correctVoterUserIds.length === 0
      ? [{ userId: authorUserId, points: 3 }]
      : correctVoterUserIds.map((userId) => ({ userId, points: 1 }));

  const claimed = await markActionOutput({
    actionId: reveal.id,
    output: {
      completedAt: new Date().toISOString(),
      authorUserId,
      correctVoterUserIds,
      pointsAwarded,
    },
  });
  if (!claimed) return;

  for (const award of pointsAwarded) {
    await db
      .update(UserGame)
      .set({ points: sql`${UserGame.points} + ${award.points}` })
      .where(
        and(
          eq(UserGame.userId, award.userId),
          eq(UserGame.gameCode, gameCode),
        ),
      );
  }

  const updatedGame = await selectGame({ gameCode });
  realtime.publish(gameChannel(gameCode), GAME_EVENTS.ACTION_ADVANCED, {
    gameCode,
    game: updatedGame,
  });
};
