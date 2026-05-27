import { eq } from "drizzle-orm";
import { z } from "zod";

import { db, GameRound, markActionOutput, selectGame } from "../../services/db";
import { GAME_EVENTS, gameChannel, realtime } from "../../services/realtime";

const propsSchema = z.object({
  gameCode: z.string().min(1),
  roundId: z.string().min(1).uuid(),
});

type RunArgs = z.infer<typeof propsSchema>;

const aiTransformItemSchema = z.object({
  userId: z.string(),
  submissionId: z.string(),
  itemIndex: z.number().int().nonnegative(),
  label: z.string(),
  originalText: z.string(),
  whoQuestion: z.string(),
});

const aiTransformOutputSchema = z.object({
  items: z.array(aiTransformItemSchema),
});

const promptSelectOutputSchema = z.object({
  submissionId: z.string(),
  itemIndex: z.number().int().nonnegative(),
});

const itemKey = (submissionId: string, itemIndex: number) =>
  `${submissionId}:${itemIndex}`;

/**
 * SYSTEM action at the start of a gameplay round. Picks one
 * AI-transformed truth from the pool that hasn't been used as a prompt yet,
 * writes it onto the PROMPT_SELECT action's `output`, and copies the
 * "who" question onto `GameRound.promptText` so the FE has a single field
 * to render. Idempotent: a concurrent caller that loses the
 * `markActionOutput` race exits without side effects.
 */
export const runPromptSelectIfReady = async ({
  gameCode,
  roundId,
}: RunArgs): Promise<void> => {
  propsSchema.parse({ gameCode, roundId });

  const round = await db.query.GameRound.findFirst({
    where: (r, { eq }) => eq(r.id, roundId),
    with: {
      actions: {
        with: {
          config: { columns: { order: true } },
          actionType: { columns: { name: true } },
        },
      },
    },
  });
  if (!round) return;
  if (round.status !== "IN_PROGRESS") return;

  const orderedActions = [...round.actions].sort(
    (a, b) => a.config.order - b.config.order,
  );
  const currentAction = orderedActions[0];
  if (!currentAction) return;
  if (currentAction.actionType.name !== "PROMPT_SELECT") return;
  if (currentAction.output !== null) return;

  const gameRounds = await db.query.GameRound.findMany({
    where: (r, { eq }) => eq(r.gameCode, gameCode),
    with: {
      actions: {
        with: {
          actionType: { columns: { name: true } },
        },
      },
    },
  });

  const pool: z.infer<typeof aiTransformItemSchema>[] = [];
  const usedKeys = new Set<string>();

  for (const r of gameRounds) {
    for (const a of r.actions) {
      if (a.output === null) continue;
      if (a.actionType.name === "AI_TRANSFORM") {
        const parsed = aiTransformOutputSchema.safeParse(a.output);
        if (parsed.success) pool.push(...parsed.data.items);
      } else if (a.actionType.name === "PROMPT_SELECT") {
        const parsed = promptSelectOutputSchema.safeParse(a.output);
        if (parsed.success) {
          usedKeys.add(itemKey(parsed.data.submissionId, parsed.data.itemIndex));
        }
      }
    }
  }

  const available = pool.filter(
    (item) => !usedKeys.has(itemKey(item.submissionId, item.itemIndex)),
  );
  if (available.length === 0) return;

  const chosen = available[Math.floor(Math.random() * available.length)];

  const claimed = await markActionOutput({
    actionId: currentAction.id,
    output: {
      selectedAt: new Date().toISOString(),
      userId: chosen.userId,
      submissionId: chosen.submissionId,
      itemIndex: chosen.itemIndex,
      label: chosen.label,
      originalText: chosen.originalText,
      whoQuestion: chosen.whoQuestion,
    },
  });
  if (!claimed) return;

  await db
    .update(GameRound)
    .set({ promptText: chosen.whoQuestion })
    .where(eq(GameRound.id, roundId));

  const updatedGame = await selectGame({ gameCode });
  realtime.publish(gameChannel(gameCode), GAME_EVENTS.ACTION_ADVANCED, {
    gameCode,
    game: updatedGame,
  });
};
