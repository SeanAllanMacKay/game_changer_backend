import { eq } from "drizzle-orm";

import {
  db,
  markActionOutput,
  selectGame,
  UserGame,
} from "../../services/db";
import { GAME_EVENTS, gameChannel, realtime } from "../../services/realtime";
import { reformatTruthsAsWhoQuestions } from "../../services/gemini";
import { truthsSubmissionSchema } from "../../games/dirtyLaundry/submissions";
import { advanceRoundIfComplete } from "./advanceRoundIfComplete";

type RunArgs = {
  gameCode: string;
  roundId: string;
  submittedActionId: string;
};

/**
 * Called after a TEXT_SUBMISSION insert. If every player in the game has now
 * submitted and the next action in the round is an AI_TRANSFORM, atomically
 * claim the transition, run Gemini, and write the transformed truths onto
 * the AI_TRANSFORM action's `output`. Idempotent and race-safe via a
 * conditional UPDATE on the TEXT_SUBMISSION's `output`.
 */
export const runAiTransformIfReady = async ({
  gameCode,
  roundId,
  submittedActionId,
}: RunArgs): Promise<void> => {
  const round = await db.query.GameRound.findFirst({
    where: (r, { eq }) => eq(r.id, roundId),
    with: {
      actions: {
        with: {
          config: { columns: { order: true } },
          actionType: { columns: { name: true } },
          submissions: true,
        },
      },
    },
  });
  if (!round) return;

  const currentAction = round.actions.find((a) => a.id === submittedActionId);
  if (!currentAction) return;
  if (currentAction.actionType.name !== "TEXT_SUBMISSION") return;
  if (currentAction.output !== null) return;

  const players = await db
    .select({ userId: UserGame.userId })
    .from(UserGame)
    .where(eq(UserGame.gameCode, gameCode));

  if (currentAction.submissions.length < players.length) return;

  const nextAction = [...round.actions]
    .filter((a) => a.config.order > currentAction.config.order)
    .sort((a, b) => a.config.order - b.config.order)[0];
  if (!nextAction || nextAction.actionType.name !== "AI_TRANSFORM") return;

  type Truth = {
    userId: string;
    submissionId: string;
    itemIndex: number;
    label: string;
    originalText: string;
  };
  const truths: Truth[] = [];
  for (const sub of currentAction.submissions) {
    const parsed = truthsSubmissionSchema.safeParse(sub.payload);
    if (!parsed.success) continue;
    parsed.data.truths.forEach((item, itemIndex) => {
      truths.push({
        userId: sub.userId,
        submissionId: sub.id,
        itemIndex,
        label: item.label,
        originalText: item.text,
      });
    });
  }
  if (truths.length === 0) return;

  // Atomically claim the TEXT_SUBMISSION transition. Concurrent submitters
  // who also pass the count check will lose the race here and bail out.
  const claimed = await markActionOutput({
    actionId: currentAction.id,
    output: {
      completedAt: new Date().toISOString(),
      submissionCount: currentAction.submissions.length,
    },
  });
  if (!claimed) return;

  const whoQuestions = await reformatTruthsAsWhoQuestions(
    truths.map((t) => t.originalText),
  );

  await markActionOutput({
    actionId: nextAction.id,
    output: {
      items: truths.map((t, i) => ({
        userId: t.userId,
        submissionId: t.submissionId,
        itemIndex: t.itemIndex,
        label: t.label,
        originalText: t.originalText,
        whoQuestion: whoQuestions[i],
      })),
    },
  });

  const updatedGame = await selectGame({ gameCode });
  realtime.publish(gameChannel(gameCode), GAME_EVENTS.ACTION_ADVANCED, {
    gameCode,
    game: updatedGame,
  });

  await advanceRoundIfComplete({ gameCode, roundId });
};
