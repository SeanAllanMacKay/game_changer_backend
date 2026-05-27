import { eq, inArray } from "drizzle-orm";
import {
  db,
  GameConfig,
  RoundConfig,
  GameRoundActionConfig,
  GameRoundActionType,
} from "../services/db";

const GAME_NAME = "Make Some Noise";

/**
 * Make Some Noise — every player hosts twice. The Gameplay round is seeded
 * with `repeatPerPlayer: true, repeatCount: 2`, which makes `startGame.ts`
 * spawn one `GameRound` per (player, repeat) and pre-populate each round's
 * `activePlayerId` with the rotating host. No explicit "assign host" action
 * is needed.
 *
 * The host writes a prompt, non-hosts take turns producing a sound; the
 * floor is exclusive — only one player holds the buzzer at a time, and each
 * player may claim at most once per prompt. The host then picks the favorite
 * and awards them 1 point.
 *
 * `HOST_PROMPT_SUBMIT` and `DECLARE_WINNER` are shared globally with the
 * other games (per-game handler lookup keeps semantics isolated). `BUZZ_IN`,
 * `HOST_SELECT_WINNER`, and `AWARD_POINT_AND_SCORE` are MSN-specific.
 */
const ACTION_TYPES = [
  {
    name: "HOST_PROMPT_SUBMIT",
    role: "HOST",
    description:
      "Host writes the prompt for this round. May optionally pick an AI-generated suggestion.",
  },
  {
    name: "BUZZ_IN",
    role: "PLAYER",
    description:
      "Non-hosts claim the floor to make a sound for the prompt with payload `{ userId }`. The host releases the floor with payload `{ userId: null }` when ready to move on. The buzzer is exclusive — only one player can hold it at a time, and each player may claim at most once per prompt.",
  },
  {
    name: "HOST_SELECT_WINNER",
    role: "HOST",
    description:
      "Host selects the player who made their favorite sound. The selected player must be one of the players who buzzed in this round. Closes the buzz-in phase.",
  },
  {
    name: "AWARD_POINT_AND_SCORE",
    role: "SYSTEM",
    description:
      "Award 1 point to the player the host selected. Auto-advances the round.",
  },
  {
    name: "DECLARE_WINNER",
    role: "SYSTEM",
    description: "Declare the player with the most points the winner.",
  },
] as const satisfies ReadonlyArray<typeof GameRoundActionType.$inferInsert>;

type ActionTypeName = (typeof ACTION_TYPES)[number]["name"];

export const seedMakeSomeNoise = async () => {
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
        description:
          "You don't need to be good at impressions, just better than your friends.",
        minPlayers: 3,
        maxPlayers: 10,
        color: "#75c5d2",
      })
      .returning();

    const [gameplayRound] = await tx
      .insert(RoundConfig)
      .values({
        gameConfigId: config.id,
        order: 1,
        repeatCount: 2,
        repeatPerPlayer: true,
        phase: "PLAY",
        name: "Gameplay",
        description:
          "Host writes a prompt, non-hosts take turns making a sound. The host picks their favorite and awards 1 point. Each player hosts twice.",
      })
      .returning();

    await tx.insert(GameRoundActionConfig).values([
      {
        roundConfigId: gameplayRound.id,
        actionTypeId: actionTypeIds.HOST_PROMPT_SUBMIT,
        order: 1,
        timer: 90_000,
        description: "Write a prompt for the other players to act out.",
        inputSchema: {
          kind: "text",
          required: true,
          label: "Prompt",
          maxLength: 280,
        },
      },
      {
        roundConfigId: gameplayRound.id,
        actionTypeId: actionTypeIds.BUZZ_IN,
        order: 2,
        timer: null,
        description:
          "Non-hosts buzz in to claim the floor (payload `{ userId: <self> }`) and make a sound. The host releases the floor (payload `{ userId: null }`) when ready to move on. Only one player can hold the floor at a time, and each player may buzz at most once per prompt.",
        inputSchema: {
          kind: "buzz",
          required: false,
          label: "Buzz in",
        },
      },
      {
        roundConfigId: gameplayRound.id,
        actionTypeId: actionTypeIds.HOST_SELECT_WINNER,
        order: 3,
        timer: null,
        description:
          "Host selects the player who made their favorite sound. The selection must be a player who buzzed in this round.",
        inputSchema: {
          kind: "choice",
          required: true,
          label: "Whose sound was best?",
        },
      },
      {
        roundConfigId: gameplayRound.id,
        actionTypeId: actionTypeIds.AWARD_POINT_AND_SCORE,
        order: 4,
        timer: null,
        description:
          "Award 1 point to the player the host selected. Auto-advances the round.",
      },
    ]);

    const [finalRound] = await tx
      .insert(RoundConfig)
      .values({
        gameConfigId: config.id,
        order: 2,
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
