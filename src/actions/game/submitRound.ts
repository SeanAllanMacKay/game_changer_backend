import * as z from "zod";
import { and, eq } from "drizzle-orm";

import {
  db,
  GameRoundSubmission,
  insertGameRoundSubmission,
  selectGameByCode,
  selectUserGame,
} from "../../services/db";
import { getActionHandler } from "../../games";
import { GAME_EVENTS, gameChannel, realtime } from "../../services/realtime";
import { HTTP_STATUSES } from "../HTTP_STATUSES";

const SubmitRoundSchema = z.object({
  gameCode: z.string().min(1),
  userId: z.string().min(1),
  actionId: z.string().uuid(),
  payload: z.record(z.string(), z.unknown()),
});

type SubmitRoundProps = z.infer<typeof SubmitRoundSchema>;

export const submitRound = async ({
  gameCode,
  userId,
  actionId,
  payload,
}: SubmitRoundProps) => {
  try {
    SubmitRoundSchema.parse({ gameCode, userId, actionId, payload });

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
        round: {
          with: {
            game: {
              with: { config: { columns: { name: true } } },
            },
          },
        },
        actionType: true,
      },
    });

    if (!action) {
      throw {
        status: HTTP_STATUSES.CLIENT_ERROR.NOT_FOUND,
        error: ["Action not found"],
      };
    }

    if (action.round.gameCode !== gameCode) {
      throw {
        status: HTTP_STATUSES.CLIENT_ERROR.NOT_FOUND,
        error: ["Action does not belong to this game"],
      };
    }

    if (action.round.status !== "IN_PROGRESS") {
      throw {
        status: HTTP_STATUSES.CLIENT_ERROR.CONFLICT,
        error: ["This round is not currently accepting submissions"],
      };
    }

    if (action.output !== null) {
      throw {
        status: HTTP_STATUSES.CLIENT_ERROR.CONFLICT,
        error: ["This action is no longer accepting submissions"],
      };
    }

    if (
      action.actionType.role !== "PLAYER" &&
      action.actionType.role !== "HOST"
    ) {
      throw {
        status: HTTP_STATUSES.CLIENT_ERROR.FORBIDDEN,
        error: ["This action does not accept player submissions"],
      };
    }

    if (!action.inputSchema) {
      throw {
        status: HTTP_STATUSES.CLIENT_ERROR.UNPROCESSABLE_CONTENT,
        error: ["This action has no input schema configured"],
      };
    }

    const gameConfigName = action.round.game.config.name;
    const actionTypeName = action.actionType.name;
    const handler = getActionHandler(gameConfigName, actionTypeName);

    if (!handler?.submissionSchema) {
      throw {
        status: HTTP_STATUSES.CLIENT_ERROR.UNPROCESSABLE_CONTENT,
        error: [
          `No submission schema registered for "${gameConfigName}" / "${actionTypeName}"`,
        ],
      };
    }

    const validatedPayload = handler.submissionSchema.parse(payload) as Record<
      string,
      unknown
    >;

    const ctx = {
      gameCode,
      roundId: action.round.id,
      actionId,
      userId,
    };

    if (handler.crossValidate) {
      await handler.crossValidate(validatedPayload, ctx);
    }

    if (!handler.allowMultipleSubmissions) {
      const existing = await db
        .select({ id: GameRoundSubmission.id })
        .from(GameRoundSubmission)
        .where(
          and(
            eq(GameRoundSubmission.userId, userId),
            eq(GameRoundSubmission.actionId, actionId),
          ),
        )
        .limit(1);
      if (existing.length > 0) {
        throw {
          status: HTTP_STATUSES.CLIENT_ERROR.CONFLICT,
          error: ["You have already submitted for this action"],
        };
      }
    }

    const submission = await insertGameRoundSubmission({
      userId,
      roundId: action.round.id,
      actionId,
      payload: validatedPayload,
    });

    realtime.publish(gameChannel(gameCode), GAME_EVENTS.SUBMISSION_RECEIVED, {
      gameCode,
      roundId: action.round.id,
      actionId,
      userId,
      submissionId: submission.id,
    });

    if (handler.onPlayerSubmit) {
      await handler.onPlayerSubmit(ctx);
    }

    return {
      status: HTTP_STATUSES.SUCCESS.CREATED,
      message: "Submission received",
      submission,
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
      error = ["There was an error submitting for this round"],
    } = caught;

    throw { status, error };
  }
};
