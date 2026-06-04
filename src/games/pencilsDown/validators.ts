import { z } from "zod";

import { db } from "../../services/db";
import { HTTP_STATUSES } from "../../actions/HTTP_STATUSES";
import {
  drawingSubmissionSchema,
  extractWinningSlotId,
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

const requireNotActiveHost = async ({
  roundId,
  userId,
}: ActionHandlerContext): Promise<void> => {
  const round = await db.query.GameRound.findFirst({
    where: (r, { eq }) => eq(r.id, roundId),
    columns: { activePlayerId: true },
  });
  if (round?.activePlayerId === userId) {
    throw {
      status: HTTP_STATUSES.CLIENT_ERROR.FORBIDDEN,
      error: ["The host doesn't draw on their own round"],
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

export const validateDrawing = async (
  payload: unknown,
  ctx: ActionHandlerContext,
): Promise<void> => {
  drawingSubmissionSchema.parse(payload);
  await requireNotActiveHost(ctx);
};

const shuffleDrawingsOutputSchema = z.object({
  slots: z.array(z.object({ slotId: z.string() })),
});

export const validateHostSelectWinner = async (
  payload: unknown,
  ctx: ActionHandlerContext,
): Promise<void> => {
  const slotId = extractWinningSlotId(payload);
  await requireActiveHost(ctx);

  const round = await db.query.GameRound.findFirst({
    where: (r, { eq }) => eq(r.id, ctx.roundId),
    with: {
      actions: {
        with: { actionType: { columns: { name: true } } },
      },
    },
  });
  const shuffle = round?.actions.find(
    (a) => a.actionType.name === "SHUFFLE_DRAWINGS",
  );
  if (!shuffle || shuffle.output === null) {
    throw {
      status: HTTP_STATUSES.CLIENT_ERROR.CONFLICT,
      error: ["Drawings have not been shuffled yet for this round"],
    };
  }

  const parsed = shuffleDrawingsOutputSchema.safeParse(shuffle.output);
  if (!parsed.success) {
    throw {
      status: HTTP_STATUSES.SERVER_ERROR.INTERNAL_SERVER_ERROR,
      error: ["Shuffle output is malformed"],
    };
  }

  if (!parsed.data.slots.some((s) => s.slotId === slotId)) {
    throw {
      status: HTTP_STATUSES.CLIENT_ERROR.UNPROCESSABLE_CONTENT,
      error: [`Winner selection must be one of: ${parsed.data.slots.map((s) => s.slotId).join(", ")}`],
    };
  }
};
