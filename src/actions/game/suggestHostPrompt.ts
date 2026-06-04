import * as z from "zod";

import {
  db,
  selectGameByCode,
  selectUserGame,
} from "../../services/db";
import {
  suggestMakeSomeNoisePrompt,
  suggestPencilsDownPrompt,
  suggestRaceToTheBottomPrompt,
} from "../../services/gemini";
import { MAKE_SOME_NOISE_GAME_NAME } from "../../games/makeSomeNoise";
import { PENCILS_DOWN_GAME_NAME } from "../../games/pencilsDown";
import { RACE_TO_THE_BOTTOM_GAME_NAME } from "../../games/raceToTheBottom";
import { HTTP_STATUSES } from "../HTTP_STATUSES";

const SUGGESTERS: Record<string, () => Promise<string>> = {
  [RACE_TO_THE_BOTTOM_GAME_NAME]: suggestRaceToTheBottomPrompt,
  [MAKE_SOME_NOISE_GAME_NAME]: suggestMakeSomeNoisePrompt,
  [PENCILS_DOWN_GAME_NAME]: suggestPencilsDownPrompt,
};

const SuggestHostPromptSchema = z.object({
  gameCode: z.string().min(1),
  userId: z.string().min(1),
  roundId: z.string().uuid(),
  actionId: z.string().uuid(),
});

type SuggestHostPromptProps = z.infer<typeof SuggestHostPromptSchema>;

/**
 * Returns an AI-generated prompt suggestion for the active host of a round
 * whose game has a registered suggester (Race to the Bottom, Make Some
 * Noise). Authorisation rules:
 * - the caller must be a player in the game,
 * - the game must be in progress,
 * - the round must be in progress and the action must be `HOST_PROMPT_SUBMIT`,
 * - the caller must be the round's `activePlayerId`.
 *
 * No DB writes; the host can then either submit one of these via
 * `submitRound` or type their own.
 */
export const suggestHostPrompt = async (props: SuggestHostPromptProps) => {
  try {
    const { gameCode, userId, roundId, actionId } =
      SuggestHostPromptSchema.parse(props);

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
            game: { with: { config: { columns: { name: true } } } },
          },
        },
        actionType: { columns: { name: true } },
      },
    });

    if (!action || action.round.gameCode !== gameCode || action.round.id !== roundId) {
      throw {
        status: HTTP_STATUSES.CLIENT_ERROR.NOT_FOUND,
        error: ["Action not found"],
      };
    }
    const suggester = SUGGESTERS[action.round.game.config.name];
    if (!suggester) {
      throw {
        status: HTTP_STATUSES.CLIENT_ERROR.UNPROCESSABLE_CONTENT,
        error: [
          `Prompt suggestions are not available for ${action.round.game.config.name}`,
        ],
      };
    }
    if (action.actionType.name !== "HOST_PROMPT_SUBMIT") {
      throw {
        status: HTTP_STATUSES.CLIENT_ERROR.UNPROCESSABLE_CONTENT,
        error: ["This action does not accept prompt suggestions"],
      };
    }
    if (action.round.status !== "IN_PROGRESS") {
      throw {
        status: HTTP_STATUSES.CLIENT_ERROR.CONFLICT,
        error: ["This round is not currently in progress"],
      };
    }
    if (action.round.activePlayerId !== userId) {
      throw {
        status: HTTP_STATUSES.CLIENT_ERROR.FORBIDDEN,
        error: ["Only the round's host can request prompt suggestions"],
      };
    }

    const prompt = await suggester();

    return {
      status: HTTP_STATUSES.SUCCESS.OK,
      message: "Suggestion generated",
      prompt,
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
      error = ["There was an error generating suggestions"],
    } = caught;

    throw { status, error };
  }
};
