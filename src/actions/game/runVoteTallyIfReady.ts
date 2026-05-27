import { eq } from "drizzle-orm";

import { db, markActionOutput, selectGame, UserGame } from "../../services/db";
import { GAME_EVENTS, gameChannel, realtime } from "../../services/realtime";
import { voteSubmissionSchema } from "../../games/dirtyLaundry/submissions";
import { runRevealAndScoreIfReady } from "./runRevealAndScoreIfReady";

type RunArgs = {
  gameCode: string;
  roundId: string;
  submittedActionId: string;
};

/**
 * Called after a DELIBERATE_AND_VOTE insert. If every player in the game has
 * now cast a vote, atomically claim the action's `output` and write the
 * tallied votes. Idempotent: a concurrent caller that loses the
 * `markActionOutput` race exits without side effects. Does not advance the
 * round — REVEAL_AND_SCORE / SHOW_STANDINGS still need to resolve first.
 */
export const runVoteTallyIfReady = async ({
  gameCode,
  roundId,
  submittedActionId,
}: RunArgs): Promise<void> => {
  const round = await db.query.GameRound.findFirst({
    where: (r, { eq }) => eq(r.id, roundId),
    with: {
      actions: {
        with: {
          actionType: { columns: { name: true } },
          submissions: true,
        },
      },
    },
  });
  if (!round) return;

  const currentAction = round.actions.find((a) => a.id === submittedActionId);
  if (!currentAction) return;
  if (currentAction.actionType.name !== "DELIBERATE_AND_VOTE") return;
  if (currentAction.output !== null) return;

  const players = await db
    .select({ userId: UserGame.userId })
    .from(UserGame)
    .where(eq(UserGame.gameCode, gameCode));

  if (currentAction.submissions.length < players.length) return;

  type Vote = { voterUserId: string; votedForUserId: string };
  const votes: Vote[] = [];
  for (const sub of currentAction.submissions) {
    const parsed = voteSubmissionSchema.safeParse(sub.payload);
    if (!parsed.success) continue;
    for (const votedForUserId of parsed.data.selectedPlayerIds) {
      votes.push({ voterUserId: sub.userId, votedForUserId });
    }
  }
  if (votes.length === 0) return;

  const claimed = await markActionOutput({
    actionId: currentAction.id,
    output: {
      completedAt: new Date().toISOString(),
      votes,
    },
  });
  if (!claimed) return;

  await runRevealAndScoreIfReady({ gameCode, roundId });

  const updatedGame = await selectGame({ gameCode });
  realtime.publish(gameChannel(gameCode), GAME_EVENTS.ACTION_ADVANCED, {
    gameCode,
    game: updatedGame,
  });
};
