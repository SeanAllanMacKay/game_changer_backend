import { GAME_EVENTS, gameChannel, realtime } from "../../services/realtime";
import { runDeclareWinnerIfReady } from "../../actions/game/runDeclareWinnerIfReady";
import type { ActionHandler, GameHandlerMap } from "../types";
import { runAwardPointAndScore } from "./handlers/runAwardPointAndScore";
import { runHostPromptSubmit } from "./handlers/runHostPromptSubmit";
import { runHostSelectWinner } from "./handlers/runHostSelectWinner";
import {
  buzzSubmissionSchema,
  computeActiveBuzzer,
  hostPromptSubmissionSchema,
  hostSelectWinnerSubmissionSchema,
} from "./submissions";
import {
  validateBuzz,
  validateHostPrompt,
  validateHostSelectWinner,
} from "./validators";

export const MAKE_SOME_NOISE_GAME_NAME = "Make Some Noise";

const hostPromptSubmit: ActionHandler = {
  submissionSchema: hostPromptSubmissionSchema,
  crossValidate: validateHostPrompt,
  onPlayerSubmit: async ({ gameCode, roundId, actionId }) => {
    await runHostPromptSubmit({ gameCode, roundId, actionId });
  },
};

const buzzIn: ActionHandler = {
  submissionSchema: buzzSubmissionSchema,
  crossValidate: validateBuzz,
  allowMultipleSubmissions: true,
  publicSubmissions: true,
  onPlayerSubmit: async ({ gameCode, roundId, actionId }) => {
    const activeUserId = await computeActiveBuzzer({ actionId });
    realtime.publish(gameChannel(gameCode), GAME_EVENTS.BUZZER_STATE_CHANGED, {
      gameCode,
      roundId,
      actionId,
      activeUserId,
    });
  },
};

const hostSelectWinner: ActionHandler = {
  submissionSchema: hostSelectWinnerSubmissionSchema,
  crossValidate: validateHostSelectWinner,
  onPlayerSubmit: async ({ gameCode, roundId, actionId }) => {
    await runHostSelectWinner({ gameCode, roundId, actionId });
  },
};

const awardPointAndScore: ActionHandler = {
  onSystemAdvance: async ({ gameCode, roundId }) => {
    await runAwardPointAndScore({ gameCode, roundId });
  },
};

const declareWinner: ActionHandler = {
  onSystemAdvance: async ({ gameCode, roundId }) => {
    await runDeclareWinnerIfReady({ gameCode, roundId });
  },
};

export const makeSomeNoiseHandlers: GameHandlerMap = {
  HOST_PROMPT_SUBMIT: hostPromptSubmit,
  BUZZ_IN: buzzIn,
  HOST_SELECT_WINNER: hostSelectWinner,
  AWARD_POINT_AND_SCORE: awardPointAndScore,
  DECLARE_WINNER: declareWinner,
};

export * from "./submissions";
