import { eq, inArray } from "drizzle-orm";
import {
  db,
  GameConfig,
  RoundConfig,
  GameRoundActionConfig,
  GameRoundActionType,
} from "../services/db";

const GAME_NAME = "Dirty Laundry";

/**
 * Generic action types — upserted by name so they can be reused across game
 * templates. The seed re-uses an existing row if one with the same name is
 * present, otherwise inserts.
 */
const ACTION_TYPES = [
  {
    name: "TEXT_SUBMISSION",
    role: "PLAYER",
    description: "Player submits one or more text entries.",
  },
  {
    name: "AI_TRANSFORM",
    role: "SYSTEM",
    description:
      "AI processes / restructures content produced by a previous action.",
  },
  {
    name: "PROMPT_SELECT",
    role: "SYSTEM",
    description: "System selects the prompt to put before players this round.",
  },
  {
    name: "DELIBERATE_AND_VOTE",
    role: "PLAYER",
    description: "Players discuss the prompt then cast a vote.",
  },
  {
    name: "REVEAL_AND_SCORE",
    role: "SYSTEM",
    description: "Reveal the source of the prompt and award points.",
  },
  {
    name: "SHOW_STANDINGS",
    role: "SYSTEM",
    description: "Display current standings on the frontend.",
  },
  {
    name: "DECLARE_WINNER",
    role: "SYSTEM",
    description: "Declare the player with the most points the winner.",
  },
] as const satisfies ReadonlyArray<typeof GameRoundActionType.$inferInsert>;

type ActionTypeName = (typeof ACTION_TYPES)[number]["name"];

export const seedDirtyLaundry = async () => {
  await db.transaction(async (tx) => {
    const existing = await tx.query.GameConfig.findFirst({
      where: (gc, { eq }) => eq(gc.name, GAME_NAME),
    });

    if (existing) {
      const gameRef = await tx.query.Game.findFirst({
        where: (g, { eq }) => eq(g.configId, existing.id),
      });
      if (gameRef) {
        throw new Error(
          `Cannot re-seed '${GAME_NAME}': Game instances reference this config. Drop those games (or the schema) first.`,
        );
      }
      const rounds = await tx.query.RoundConfig.findMany({
        where: (rc, { eq }) => eq(rc.gameConfigId, existing.id),
      });
      const roundIds = rounds.map((r) => r.id);
      if (roundIds.length > 0) {
        await tx
          .delete(GameRoundActionConfig)
          .where(inArray(GameRoundActionConfig.roundConfigId, roundIds));
        await tx.delete(RoundConfig).where(inArray(RoundConfig.id, roundIds));
      }
      await tx.delete(GameConfig).where(eq(GameConfig.id, existing.id));
    }

    const actionTypeIds = {} as Record<ActionTypeName, string>;
    for (const t of ACTION_TYPES) {
      const found = await tx.query.GameRoundActionType.findFirst({
        where: (gat, { eq }) => eq(gat.name, t.name),
      });
      if (found) {
        const [updated] = await tx
          .update(GameRoundActionType)
          .set({ role: t.role, description: t.description })
          .where(eq(GameRoundActionType.id, found.id))
          .returning();
        actionTypeIds[t.name] = updated.id;
      } else {
        const [inserted] = await tx
          .insert(GameRoundActionType)
          .values(t)
          .returning();
        actionTypeIds[t.name] = inserted.id;
      }
    }

    const [config] = await tx
      .insert(GameConfig)
      .values({
        name: GAME_NAME,
        description: `There are some secrets we take to the grave, and others we share in a game to win made up points. This is Dirty Laundry. The game that asks "How well do I really know my friends?"`,
        minPlayers: 4,
        maxPlayers: 10,
        color: "#190a4d",
      })
      .returning();

    const [setupRound] = await tx
      .insert(RoundConfig)
      .values({
        gameConfigId: config.id,
        order: 1,
        repeatCount: 1,
        repeatPerPlayer: false,
        phase: "SETUP",
        name: "Setup",
        description:
          "Players submit their truths; AI neutralises writing style.",
      })
      .returning();

    await tx.insert(GameRoundActionConfig).values([
      {
        roundConfigId: setupRound.id,
        actionTypeId: actionTypeIds.TEXT_SUBMISSION,
        order: 1,
        timer: 180_000,
        description: "Tell us some of your dirty laundry",
        prompt:
          "Submit at least 2 true statements about yourself. Surprising, specific, or embarrassing truths play better than generic ones.",
        inputSchema: {
          truths: [
            { kind: "text", required: true, label: "Secret #1" },
            { kind: "text", required: true, label: "Secret #2" },
          ],
        },
      },
      {
        roundConfigId: setupRound.id,
        actionTypeId: actionTypeIds.AI_TRANSFORM,
        order: 2,
        timer: null,
        description:
          "AI rewrites every submitted truth in a neutral voice so writing style can't give away the author.",
        prompt:
          "Rewrite each of the following truths in a neutral, consistent voice. Preserve the factual content exactly. Strip distinctive vocabulary, punctuation habits, capitalisation quirks, and sentence rhythms that could identify the author.",
      },
    ]);

    const [gameplayRound] = await tx
      .insert(RoundConfig)
      .values({
        gameConfigId: config.id,
        order: 2,
        repeatCount: 2,
        repeatPerPlayer: true,
        phase: "PLAY",
        name: "Gameplay",
        description:
          "One truth per round: deliberate, vote, reveal, score. Repeated 2 times per player.",
      })
      .returning();

    await tx.insert(GameRoundActionConfig).values([
      {
        roundConfigId: gameplayRound.id,
        actionTypeId: actionTypeIds.PROMPT_SELECT,
        order: 1,
        timer: null,
        description:
          "Pick a truth from the pool. Occasionally substitute an AI-generated decoy that matches the group's style.",
        prompt:
          "Select one unused truth from the submitted pool for this round. With low probability, replace it with an AI-generated truth that plausibly fits the players' submissions.",
      },
      {
        roundConfigId: gameplayRound.id,
        actionTypeId: actionTypeIds.DELIBERATE_AND_VOTE,
        order: 2,
        timer: 90_000,
        description:
          "Players discuss the prompt aloud, then each casts a vote for who they think submitted it.",
        inputSchema: {
          kind: "playerSelect",
          selectCount: 1,
          allowSelf: false,
          ordered: false,
        },
      },
      {
        roundConfigId: gameplayRound.id,
        actionTypeId: actionTypeIds.REVEAL_AND_SCORE,
        order: 3,
        timer: null,
        description:
          "Reveal the truth's author. 3 points to the author if nobody guessed correctly; 1 point to each player who did.",
      },
      {
        roundConfigId: gameplayRound.id,
        actionTypeId: actionTypeIds.SHOW_STANDINGS,
        order: 4,
        timer: null,
        description: "Display the current point standings on the frontend.",
      },
    ]);

    const [finalRound] = await tx
      .insert(RoundConfig)
      .values({
        gameConfigId: config.id,
        order: 3,
        repeatCount: 1,
        repeatPerPlayer: false,
        phase: "RESULTS",
        name: "Final",
        description: "Declare the winner.",
      })
      .returning();

    await tx.insert(GameRoundActionConfig).values([
      {
        roundConfigId: finalRound.id,
        actionTypeId: actionTypeIds.DECLARE_WINNER,
        order: 1,
        timer: null,
        description:
          "Declare the player with the most points the winner of the game.",
      },
    ]);

    return config;
  });
};
