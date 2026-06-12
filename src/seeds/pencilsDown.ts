import { eq, inArray } from "drizzle-orm";
import {
  db,
  GameConfig,
  RoundConfig,
  GameRoundActionConfig,
  GameRoundActionType,
} from "../services/db";

const GAME_NAME = "Pencils Down";

/**
 * Pencils Down — every player hosts twice. The Gameplay round is seeded with
 * `repeatPerPlayer: true, repeatCount: 2`, which makes `startGame.ts` spawn
 * one `GameRound` per (player, repeat) and pre-populate each round's
 * `activePlayerId` with the rotating host. No explicit "assign host" action
 * is needed (mirrors Make Some Noise and Race to the Bottom).
 *
 * Round flow: host writes a drawing prompt; non-hosts each submit one
 * drawing (3 min timer); a SYSTEM action shuffles the drawings into
 * anonymous slots (A, B, C, ...) and writes them to its `output`, which
 * `selectGame` exposes to everyone; the host picks a winning slot without
 * knowing the author; REVEAL_AND_SCORE maps the slot back to the author and
 * awards 1 point.
 *
 * `HOST_PROMPT_SUBMIT`, `HOST_SELECT_WINNER`, `REVEAL_AND_SCORE`, and
 * `DECLARE_WINNER` are shared globally with the other games (per-game
 * handler lookup keeps semantics isolated). `DRAWING_SUBMISSION` and
 * `SHUFFLE_DRAWINGS` are PD-specific.
 */
const ACTION_TYPES = [
  {
    name: "HOST_PROMPT_SUBMIT",
    role: "HOST",
    description: "What are the other players draweing?",
  },
  {
    name: "DRAWING_SUBMISSION",
    role: "PLAYER",
    description:
      "Non-hosts each submit one drawing of the host's prompt. Stored as a stroke array in `payload.field[0].text` (JSON-encoded) so the FE canvas can re-render it later.",
  },
  {
    name: "SHUFFLE_DRAWINGS",
    role: "SYSTEM",
    description:
      "Collects every DRAWING_SUBMISSION, applies a deterministic shuffle keyed by `roundId`, and writes the drawings to its `output.slots` as `{ slotId, drawing }` with no author references. The FE renders these for the host's blind pick.",
  },
  {
    name: "HOST_SELECT_WINNER",
    role: "HOST",
    description:
      "Host selects the slot whose drawing they like best. Picks a `slotId` from SHUFFLE_DRAWINGS.output, not a userId.",
  },
  {
    name: "REVEAL_AND_SCORE",
    role: "SYSTEM",
    description:
      "Reveal the author of the winning drawing and award 1 point. Re-applies the same deterministic shuffle to map slotId → userId.",
  },
  {
    name: "DECLARE_WINNER",
    role: "SYSTEM",
    description: "Declare the player with the most points the winner.",
  },
] as const satisfies ReadonlyArray<typeof GameRoundActionType.$inferInsert>;

type ActionTypeName = (typeof ACTION_TYPES)[number]["name"];

export const seedPencilsDown = async () => {
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
          "Can creativity make up for artistic ability? Probably not, but you might win anyway.",
        minPlayers: 3,
        maxPlayers: 10,
        color: "#eb5017",
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
          "Host writes a prompt, non-hosts draw it (3 minutes), the host picks a favourite blind, and the author is revealed and scored. Each player hosts twice.",
      })
      .returning();

    await tx.insert(GameRoundActionConfig).values([
      {
        roundConfigId: gameplayRound.id,
        actionTypeId: actionTypeIds.HOST_PROMPT_SUBMIT,
        order: 1,
        timer: 90_000,
        description: "Write a prompt for the other players to draw.",
        inputSchema: {
          kind: "text",
          required: true,
          label: "Prompt",
          maxLength: 280,
        },
      },
      {
        roundConfigId: gameplayRound.id,
        actionTypeId: actionTypeIds.DRAWING_SUBMISSION,
        order: 2,
        timer: 180_000,
        description:
          "Draw the host's prompt. You have 3 minutes. The drawing is stored as a stroke array so the FE canvas can re-render it later.",
        inputSchema: {
          kind: "drawing",
          required: true,
          label: "Your drawing",
        },
      },
      {
        roundConfigId: gameplayRound.id,
        actionTypeId: actionTypeIds.SHUFFLE_DRAWINGS,
        order: 3,
        timer: null,
        description:
          "Anonymise the drawings into slots (A, B, C, ...) for the host's blind pick. Auto-advances the round.",
      },
      {
        roundConfigId: gameplayRound.id,
        actionTypeId: actionTypeIds.HOST_SELECT_WINNER,
        order: 4,
        timer: null,
        description:
          "Host picks the slot whose drawing they like best. The author is not revealed until the next step.",
        inputSchema: {
          kind: "choice",
          required: true,
          label: "Which drawing wins?",
        },
      },
      {
        roundConfigId: gameplayRound.id,
        actionTypeId: actionTypeIds.REVEAL_AND_SCORE,
        order: 5,
        timer: null,
        description:
          "Reveal the author of the winning drawing and award them 1 point. Auto-advances the round.",
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
