import { db } from "../../services/db";
import { HTTP_STATUSES } from "../../actions/HTTP_STATUSES";
import {
  buzzSubmissionSchema,
  computeActiveBuzzer,
  extractWinnerId,
  findUsersWhoClaimed,
  hostPromptSubmissionSchema,
} from "./submissions";
import type { ActionHandlerContext } from "../types";

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

/**
 * Buzzer rules:
 *  1. CLAIM (`payload.userId === ctx.userId`) — submitted by a non-host
 *     player:
 *     - Submitter cannot be the round's host.
 *     - Payload userId must match the submitter — you can't claim on
 *       behalf of someone else.
 *     - Submitter must not have already claimed this round (one buzz per
 *       player per prompt).
 *     - No other player can currently hold the floor.
 *  2. RELEASE (`payload.userId === null`) — submitted by the round's host:
 *     - Submitter must be the round's host. Players cannot release
 *       themselves; the host decides when each performance ends.
 *     - There must currently be an active buzzer to release.
 *
 * Race-window note: two CLAIM submissions arriving simultaneously can both
 * pass `computeActiveBuzzer === null` before either commits. The game is
 * played in person and the window is sub-millisecond; we accept "last write
 * wins" as the effective active buzzer and let players replay socially.
 */
export const validateBuzz = async (
  payload: unknown,
  ctx: ActionHandlerContext,
): Promise<void> => {
  const parsed = buzzSubmissionSchema.parse(payload);

  const round = await db.query.GameRound.findFirst({
    where: (r, { eq }) => eq(r.id, ctx.roundId),
    columns: { activePlayerId: true },
  });
  const isHost = round?.activePlayerId === ctx.userId;

  if (parsed.userId === null) {
    if (!isHost) {
      throw {
        status: HTTP_STATUSES.CLIENT_ERROR.FORBIDDEN,
        error: ["Only the host can release the buzzer"],
      };
    }
    const activeUserId = await computeActiveBuzzer({ actionId: ctx.actionId });
    if (activeUserId === null) {
      throw {
        status: HTTP_STATUSES.CLIENT_ERROR.CONFLICT,
        error: ["No one currently holds the buzzer"],
      };
    }
    return;
  }

  if (isHost) {
    throw {
      status: HTTP_STATUSES.CLIENT_ERROR.FORBIDDEN,
      error: ["The host cannot buzz in on their own round"],
    };
  }

  if (parsed.userId !== ctx.userId) {
    throw {
      status: HTTP_STATUSES.CLIENT_ERROR.FORBIDDEN,
      error: ["You cannot claim the buzzer on behalf of another player"],
    };
  }

  const [claimed, activeUserId] = await Promise.all([
    findUsersWhoClaimed({ actionId: ctx.actionId }),
    computeActiveBuzzer({ actionId: ctx.actionId }),
  ]);

  if (claimed.has(ctx.userId)) {
    throw {
      status: HTTP_STATUSES.CLIENT_ERROR.CONFLICT,
      error: ["You have already buzzed in this round"],
    };
  }

  if (activeUserId !== null) {
    throw {
      status: HTTP_STATUSES.CLIENT_ERROR.CONFLICT,
      error: ["Another player currently holds the buzzer"],
    };
  }
};

export const validateHostSelectWinner = async (
  payload: unknown,
  ctx: ActionHandlerContext,
): Promise<void> => {
  const winnerId = extractWinnerId(payload);
  await requireActiveHost(ctx);

  const round = await db.query.GameRound.findFirst({
    where: (r, { eq }) => eq(r.id, ctx.roundId),
    with: {
      actions: {
        with: { actionType: { columns: { name: true } } },
      },
    },
  });
  const buzzAction = round?.actions.find(
    (a) => a.actionType.name === "BUZZ_IN",
  );
  if (!buzzAction) {
    throw {
      status: HTTP_STATUSES.CLIENT_ERROR.CONFLICT,
      error: ["No buzz-in action found for this round"],
    };
  }

  const claimed = await findUsersWhoClaimed({ actionId: buzzAction.id });
  if (!claimed.has(winnerId)) {
    throw {
      status: HTTP_STATUSES.CLIENT_ERROR.UNPROCESSABLE_CONTENT,
      error: ["Winner must be a player who buzzed in this round"],
    };
  }
};
