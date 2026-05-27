import { eq, inArray } from "drizzle-orm";
import {
  db,
  GameConfig,
  RoundConfig,
  GameRoundActionConfig,
  GameRoundActionType,
} from "../services/db";

const GAME_NAME = "Race to the Bottom";

/**
 * Race to the Bottom — every player hosts twice. The Gameplay round is
 * seeded with `repeatPerPlayer: true, repeatCount: 2`, which makes
 * `startGame.ts` spawn one `GameRound` per (player, repeat) and pre-populate
 * each round's `activePlayerId` with the rotating host. No explicit
 * "assign host" action is needed.
 *
 * Action types named `HOST_PROMPT_SUBMIT`, `AUCTION_BID`, `HOST_FINALIZE`,
 * `HOST_CONFIRM_COMPLETION`, and `BID_RESOLVE_AND_SCORE` are reserved for
 * this game — Dirty Laundry does not register handlers for them, and vice
 * versa.
 */
const ACTION_TYPES = [
  {
    name: "HOST_PROMPT_SUBMIT",
    role: "HOST",
    description:
      "Host writes the prompt for this round. May optionally pick an AI-generated suggestion.",
  },
  {
    name: "AUCTION_BID",
    role: "PLAYER",
    description:
      "Non-hosts place bids; each bid must be strictly lower than the current low.",
  },
  {
    name: "HOST_FINALIZE",
    role: "HOST",
    description: "Host taps once to close bidding and lock in the winner.",
  },
  {
    name: "HOST_CONFIRM_COMPLETION",
    role: "HOST",
    description:
      "Host confirms whether the winning bidder actually completed the prompt. Points are only awarded on confirmation.",
  },
  {
    name: "BID_RESOLVE_AND_SCORE",
    role: "SYSTEM",
    description:
      "If the host confirmed completion, award the winning bid amount as points. Auto-advances the round.",
  },
  {
    name: "DECLARE_WINNER",
    role: "SYSTEM",
    description: "Declare the player with the most points the winner.",
  },
] as const satisfies ReadonlyArray<typeof GameRoundActionType.$inferInsert>;

type ActionTypeName = (typeof ACTION_TYPES)[number]["name"];

export const seedRaceToTheBottom = async () => {
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
          "How low will you go for made-up points in a game with your friends?",
        minPlayers: 3,
        maxPlayers: 10,
        color: "#276221",
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
          "Host picks a prompt, players bid down. Lowest bidder must complete the prompt and wins the bid amount in points. Each player hosts twice.",
      })
      .returning();

    await tx.insert(GameRoundActionConfig).values([
      {
        roundConfigId: gameplayRound.id,
        actionTypeId: actionTypeIds.HOST_PROMPT_SUBMIT,
        order: 1,
        timer: 90_000,
        description:
          "Host writes a challenge for the other players to bid on. The host can request AI suggestions.",
        prompt:
          "You are suggesting silly, doable party-game challenges for the host of Race to the Bottom. Each suggestion should be one short sentence, in plain English, describing an action that can be completed in under two minutes with no special props.",
        inputSchema: {
          kind: "text",
          required: true,
          label: "Challenge",
          maxLength: 280,
        },
      },
      {
        roundConfigId: gameplayRound.id,
        actionTypeId: actionTypeIds.AUCTION_BID,
        order: 2,
        timer: null,
        description:
          "Non-hosts place bids. Each new bid must be strictly lower than the current low. Bidding stays open until the host finalises the round.",
        inputSchema: {
          kind: "number",
          required: true,
          min: 0,
          max: 10000,
          label: "Bid",
        },
      },
      {
        roundConfigId: gameplayRound.id,
        actionTypeId: actionTypeIds.HOST_FINALIZE,
        order: 3,
        timer: null,
        description:
          "Host taps once to close bidding and lock in the lowest bidder as the winner.",
        inputSchema: {
          kind: "ack",
          required: true,
          label: "Close bidding",
        },
      },
      {
        roundConfigId: gameplayRound.id,
        actionTypeId: actionTypeIds.HOST_CONFIRM_COMPLETION,
        order: 4,
        timer: null,
        description:
          "Host watches the winner attempt the prompt and confirms whether they completed it. Points are only awarded on confirmation.",
        inputSchema: {
          kind: "choice",
          required: true,
          label: "Did the winner complete the prompt?",
          options: [
            { value: "confirmed", label: "Yes — award points" },
            { value: "denied", label: "No — no points" },
          ],
        },
      },
      {
        roundConfigId: gameplayRound.id,
        actionTypeId: actionTypeIds.BID_RESOLVE_AND_SCORE,
        order: 5,
        timer: null,
        description:
          "If the host confirmed completion, award the winning bid amount as points to the lowest bidder. If denied or nobody bid, no points are awarded. Auto-advances the round.",
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
