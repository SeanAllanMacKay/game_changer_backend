import * as z from "zod";

import {
  db,
  markActionOutput,
  selectGameByCode,
  selectUserGame,
} from "../../services/db";
import { HTTP_STATUSES } from "../HTTP_STATUSES";
import { advanceRoundIfComplete } from "./advanceRoundIfComplete";

// Action types whose `output` is written by the FE acknowledging the display.
// Other SYSTEM actions (PROMPT_SELECT, AI_TRANSFORM, REVEAL_AND_SCORE,
// DECLARE_WINNER) resolve server-side and must not be completable from a
// client.
const FE_COMPLETABLE_ACTION_TYPES = new Set(["SHOW_STANDINGS"]);

// When the round has revealed a truth's author (Dirty Laundry's
// REVEAL_AND_SCORE), the player whose truth it was for the round owns the
// "continue" — not the game owner.
const revealAndScoreOutputSchema = z.object({
  authorUserId: z.string(),
});

const CompleteActionSchema = z.object({
  gameCode: z.string().min(1),
  userId: z.string().min(1),
  roundId: z.string().uuid(),
  actionId: z.string().uuid(),
});

type CompleteActionProps = z.infer<typeof CompleteActionSchema>;

export const completeAction = async (props: CompleteActionProps) => {
  try {
    const { gameCode, userId, roundId, actionId } =
      CompleteActionSchema.parse(props);

    const game = await selectGameByCode({ gameCode });
    if (!game) {
      throw {
        status: HTTP_STATUSES.CLIENT_ERROR.NOT_FOUND,
        error: ["Game not found"],
      };
    }
    if (game.status !== "IN_PROGRESS") {
      throw {
        status: HTTP_STATUSES.CLIENT_ERROR.CONFLICT,
        error: ["This game is not in progress"],
      };
    }

    const membership = await selectUserGame({ userId, gameCode });
    if (!membership) {
      throw {
        status: HTTP_STATUSES.CLIENT_ERROR.FORBIDDEN,
        error: ["You are not a player in this game"],
      };
    }

    const action = await db.query.GameRoundAction.findFirst({
      where: (a, { eq }) => eq(a.id, actionId),
      with: {
        round: true,
        actionType: true,
      },
    });
    if (!action) {
      throw {
        status: HTTP_STATUSES.CLIENT_ERROR.NOT_FOUND,
        error: ["Action not found"],
      };
    }
    if (action.round.id !== roundId || action.round.gameCode !== gameCode) {
      throw {
        status: HTTP_STATUSES.CLIENT_ERROR.NOT_FOUND,
        error: ["Action does not belong to this round"],
      };
    }
    if (action.round.status !== "IN_PROGRESS") {
      throw {
        status: HTTP_STATUSES.CLIENT_ERROR.CONFLICT,
        error: ["This round is not currently in progress"],
      };
    }
    if (action.actionType.role !== "SYSTEM") {
      throw {
        status: HTTP_STATUSES.CLIENT_ERROR.FORBIDDEN,
        error: ["This action is not completable"],
      };
    }
    if (!FE_COMPLETABLE_ACTION_TYPES.has(action.actionType.name)) {
      throw {
        status: HTTP_STATUSES.CLIENT_ERROR.FORBIDDEN,
        error: ["This action is not completable"],
      };
    }

    // If this round revealed a truth's author (Dirty Laundry's
    // REVEAL_AND_SCORE), the player whose truth it was for the round owns the
    // "continue". Otherwise any player in the game may complete it.
    const roundActions = await db.query.GameRoundAction.findMany({
      where: (a, { eq }) => eq(a.roundId, roundId),
      with: { actionType: { columns: { name: true } } },
    });
    const reveal = roundActions.find(
      (a) => a.actionType.name === "REVEAL_AND_SCORE",
    );
    if (reveal?.output) {
      const parsed = revealAndScoreOutputSchema.safeParse(reveal.output);
      if (parsed.success && parsed.data.authorUserId !== userId) {
        throw {
          status: HTTP_STATUSES.CLIENT_ERROR.FORBIDDEN,
          error: ["Only the player whose truth was revealed can continue"],
        };
      }
    }

    const claimed = await markActionOutput({
      actionId,
      output: { completedAt: new Date().toISOString() },
    });

    if (claimed) {
      await advanceRoundIfComplete({ gameCode, roundId });
    }

    return {
      status: HTTP_STATUSES.SUCCESS.OK,
      message: "Action completed",
    };
  } catch (caught: any) {
    if (caught instanceof z.ZodError) {
      throw {
        status: HTTP_STATUSES.CLIENT_ERROR.BAD_REQUEST,
        error: caught.issues.map(({ message }) => message),
      };
    }

    const {
      status = HTTP_STATUSES.SERVER_ERROR.INTERNAL_SERVER_ERROR,
      error = ["There was an error completing this action"],
    } = caught;

    throw { status, error };
  }
};
