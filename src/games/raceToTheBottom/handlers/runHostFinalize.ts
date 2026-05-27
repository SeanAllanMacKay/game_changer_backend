import { and, asc, eq } from "drizzle-orm";

import {
  db,
  GameRoundSubmission,
  markActionOutput,
  selectGame,
} from "../../../services/db";
import { GAME_EVENTS, gameChannel, realtime } from "../../../services/realtime";
import { tryExtractBidAmount } from "../submissions";

type RunArgs = {
  gameCode: string;
  roundId: string;
  actionId: string;
};

/**
 * Fires after the host submits HOST_FINALIZE. Atomically closes the
 * AUCTION_BID action (computing winner + amount from the submissions
 * recorded so far) and CAS-marks HOST_FINALIZE's own output as completed.
 * Scoring is deferred until HOST_CONFIRM_COMPLETION resolves — points
 * aren't awarded until the host confirms the winner actually performed
 * the prompt.
 *
 * Idempotent: every write is a CAS via `markActionOutput`, so concurrent
 * host taps converge on the same outcome.
 */
export const runHostFinalize = async ({
  gameCode,
  roundId,
  actionId,
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

  const auction = round.actions.find((a) => a.actionType.name === "AUCTION_BID");
  const finalize = round.actions.find((a) => a.id === actionId);
  if (!auction || !finalize) return;

  if (auction.output === null) {
    const rows = await db
      .select({
        userId: GameRoundSubmission.userId,
        payload: GameRoundSubmission.payload,
        createdAt: GameRoundSubmission.createdAt,
      })
      .from(GameRoundSubmission)
      .where(
        and(
          eq(GameRoundSubmission.actionId, auction.id),
          eq(GameRoundSubmission.roundId, roundId),
        ),
      )
      .orderBy(asc(GameRoundSubmission.createdAt));

    const bids: { userId: string; amount: number; createdAt: string }[] = [];
    for (const row of rows) {
      const amount = tryExtractBidAmount(row.payload);
      if (amount === null) continue;
      bids.push({
        userId: row.userId,
        amount,
        createdAt: row.createdAt.toISOString(),
      });
    }

    let winnerUserId: string | null = null;
    let amount = 0;
    if (bids.length > 0) {
      const lowest = bids.reduce((acc, b) => (b.amount < acc.amount ? b : acc));
      winnerUserId = lowest.userId;
      amount = lowest.amount;
    }

    await markActionOutput({
      actionId: auction.id,
      output: {
        closedAt: new Date().toISOString(),
        winnerUserId,
        amount,
        bids,
      },
    });
  }

  await markActionOutput({
    actionId: finalize.id,
    output: { completedAt: new Date().toISOString() },
  });

  const updatedGame = await selectGame({ gameCode });
  realtime.publish(gameChannel(gameCode), GAME_EVENTS.ACTION_ADVANCED, {
    gameCode,
    game: updatedGame,
  });
};
