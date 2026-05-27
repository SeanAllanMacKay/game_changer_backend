import { and, asc, eq, sql } from "drizzle-orm";

import {
  db,
  GameRoundSubmission,
  markActionOutput,
  selectGame,
  UserGame,
} from "../../../services/db";
import { GAME_EVENTS, gameChannel, realtime } from "../../../services/realtime";
import { tryExtractBidAmount } from "../submissions";
import { advanceRoundIfComplete } from "../../../actions/game/advanceRoundIfComplete";

type RunArgs = {
  gameCode: string;
  roundId: string;
};

/**
 * SYSTEM action: reads the snapshot stored on AUCTION_BID.output by
 * `runHostFinalize` (winnerUserId + amount) and the `confirmed` flag from
 * HOST_CONFIRM_COMPLETION.output, CAS-writes the consolidated payload
 * onto BID_RESOLVE_AND_SCORE.output, and awards the bid amount to the
 * winner's `UserGame.points` **only if the host confirmed completion**.
 * If nobody bid (winnerUserId is null) or the host denied completion,
 * no points are awarded. After writing its own output, calls
 * `advanceRoundIfComplete` to move the game forward — there's no
 * SHOW_STANDINGS step in this game. Idempotent: the CAS prevents
 * double-awards.
 */
export const runBidResolveAndScore = async ({
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

  const resolve = round.actions.find(
    (a) => a.actionType.name === "BID_RESOLVE_AND_SCORE",
  );
  if (!resolve || resolve.output !== null) return;

  const confirm = round.actions.find(
    (a) => a.actionType.name === "HOST_CONFIRM_COMPLETION",
  );
  if (!confirm || confirm.output === null) return;
  const confirmed =
    typeof confirm.output === "object" &&
    confirm.output !== null &&
    (confirm.output as { confirmed?: unknown }).confirmed === true;

  const auction = round.actions.find((a) => a.actionType.name === "AUCTION_BID");

  let winnerUserId: string | null = null;
  let amount = 0;
  let bids: { userId: string; amount: number; createdAt: string }[] = [];

  if (auction?.output && typeof auction.output === "object") {
    const out = auction.output as {
      winnerUserId?: string | null;
      amount?: number;
      bids?: { userId: string; amount: number; createdAt: string }[];
    };
    winnerUserId = out.winnerUserId ?? null;
    amount = out.amount ?? 0;
    bids = out.bids ?? [];
  } else {
    // Fallback in case AUCTION_BID wasn't closed (shouldn't happen in
    // normal flow): compute directly from submissions here.
    const rows = await db
      .select({
        userId: GameRoundSubmission.userId,
        payload: GameRoundSubmission.payload,
        createdAt: GameRoundSubmission.createdAt,
      })
      .from(GameRoundSubmission)
      .where(
        and(
          eq(GameRoundSubmission.actionId, auction?.id ?? ""),
          eq(GameRoundSubmission.roundId, roundId),
        ),
      )
      .orderBy(asc(GameRoundSubmission.createdAt));

    for (const row of rows) {
      const value = tryExtractBidAmount(row.payload);
      if (value === null) continue;
      bids.push({
        userId: row.userId,
        amount: value,
        createdAt: row.createdAt.toISOString(),
      });
    }
    if (bids.length > 0) {
      const lowest = bids.reduce((acc, b) => (b.amount < acc.amount ? b : acc));
      winnerUserId = lowest.userId;
      amount = lowest.amount;
    }
  }

  const claimed = await markActionOutput({
    actionId: resolve.id,
    output: {
      completedAt: new Date().toISOString(),
      winnerUserId,
      amount,
      confirmed,
      bids,
    },
  });
  if (!claimed) return;

  if (confirmed && winnerUserId && amount > 0) {
    await db
      .update(UserGame)
      .set({ points: sql`${UserGame.points} + ${amount}` })
      .where(
        and(eq(UserGame.userId, winnerUserId), eq(UserGame.gameCode, gameCode)),
      );
  }

  const updatedGame = await selectGame({ gameCode });
  realtime.publish(gameChannel(gameCode), GAME_EVENTS.ACTION_ADVANCED, {
    gameCode,
    game: updatedGame,
  });

  await advanceRoundIfComplete({ gameCode, roundId });
};
