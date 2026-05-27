import { and, eq } from "drizzle-orm";

import { db, GameRoundSubmission } from "../../services/db";
import { HTTP_STATUSES } from "../../actions/HTTP_STATUSES";
import {
  extractBidAmount,
  hostConfirmCompletionSubmissionSchema,
  hostFinalizeSubmissionSchema,
  hostPromptSubmissionSchema,
  tryExtractBidAmount,
} from "./submissions";
import type { ActionHandlerContext } from "../types";

/**
 * Cross-state check used by both HOST_PROMPT_SUBMIT and HOST_FINALIZE:
 * the submitter must be the round's `activePlayerId`. `startGame` populates
 * `activePlayerId` per round via the `repeatPerPlayer` rotation, so we
 * simply compare here — no rotation logic is needed at submit time.
 */
const requireActiveHost = async ({
  roundId,
  userId,
}: ActionHandlerContext): Promise<void> => {
  const round = await db.query.GameRound.findFirst({
    where: (r, { eq }) => eq(r.id, roundId),
    columns: { activePlayerId: true },
  });
  if (!round || round.activePlayerId !== userId) {
    throw {
      status: HTTP_STATUSES.CLIENT_ERROR.FORBIDDEN,
      error: ["Only the round's host can perform this action"],
    };
  }
};

export const validateHostPrompt = async (
  payload: unknown,
  ctx: ActionHandlerContext,
): Promise<void> => {
  hostPromptSubmissionSchema.parse(payload);
  await requireActiveHost(ctx);
};

export const validateHostFinalize = async (
  payload: unknown,
  ctx: ActionHandlerContext,
): Promise<void> => {
  hostFinalizeSubmissionSchema.parse(payload);
  await requireActiveHost(ctx);
};

export const validateHostConfirmCompletion = async (
  payload: unknown,
  ctx: ActionHandlerContext,
): Promise<void> => {
  hostConfirmCompletionSubmissionSchema.parse(payload);
  await requireActiveHost(ctx);
};

/**
 * Bidding rules:
 * 1. Host cannot bid on their own round.
 * 2. Each bid must be strictly less than the current low (the minimum
 *    amount across all existing AUCTION_BID submissions on this action).
 *
 * There is a small race window: two clients submitting the same low bid
 * concurrently can both pass the check. `runBidResolveAndScore` is the
 * tiebreaker — it picks the earliest by `createdAt`.
 */
export const validateBid = async (
  payload: unknown,
  ctx: ActionHandlerContext,
): Promise<void> => {
  const amount = extractBidAmount(payload);

  const round = await db.query.GameRound.findFirst({
    where: (r, { eq }) => eq(r.id, ctx.roundId),
    columns: { activePlayerId: true },
  });
  if (round?.activePlayerId === ctx.userId) {
    throw {
      status: HTTP_STATUSES.CLIENT_ERROR.FORBIDDEN,
      error: ["The host cannot bid on their own round"],
    };
  }

  const existing = await db
    .select({ payload: GameRoundSubmission.payload })
    .from(GameRoundSubmission)
    .where(
      and(
        eq(GameRoundSubmission.actionId, ctx.actionId),
        eq(GameRoundSubmission.roundId, ctx.roundId),
      ),
    );

  let currentLow: number | null = null;
  for (const row of existing) {
    const value = tryExtractBidAmount(row.payload);
    if (value === null) continue;
    if (currentLow === null || value < currentLow) {
      currentLow = value;
    }
  }

  if (currentLow !== null && amount >= currentLow) {
    throw {
      status: HTTP_STATUSES.CLIENT_ERROR.UNPROCESSABLE_CONTENT,
      error: [`Bid must be lower than the current low of ${currentLow}`],
    };
  }
};
