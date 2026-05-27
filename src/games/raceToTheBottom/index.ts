import { selectGame } from "../../services/db";
import { GAME_EVENTS, gameChannel, realtime } from "../../services/realtime";
import { runDeclareWinnerIfReady } from "../../actions/game/runDeclareWinnerIfReady";
import type { ActionHandler, GameHandlerMap } from "../types";
import { runBidResolveAndScore } from "./handlers/runBidResolveAndScore";
import { runHostConfirmCompletion } from "./handlers/runHostConfirmCompletion";
import { runHostFinalize } from "./handlers/runHostFinalize";
import { runHostPromptSubmit } from "./handlers/runHostPromptSubmit";
import {
  bidSubmissionSchema,
  findLowestBid,
  hostConfirmCompletionSubmissionSchema,
  hostFinalizeSubmissionSchema,
  hostPromptSubmissionSchema,
} from "./submissions";
import {
  validateBid,
  validateHostConfirmCompletion,
  validateHostFinalize,
  validateHostPrompt,
} from "./validators";

export const RACE_TO_THE_BOTTOM_GAME_NAME = "Race to the Bottom";

const hostPromptSubmit: ActionHandler = {
  submissionSchema: hostPromptSubmissionSchema,
  crossValidate: validateHostPrompt,
  onPlayerSubmit: async ({ gameCode, roundId, actionId }) => {
    await runHostPromptSubmit({ gameCode, roundId, actionId });
  },
};

const auctionBid: ActionHandler = {
  submissionSchema: bidSubmissionSchema,
  crossValidate: validateBid,
  allowMultipleSubmissions: true,
  publicSubmissions: true,
  onPlayerSubmit: async ({ gameCode, actionId }) => {
    const updatedGame = await selectGame({ gameCode });
    const action = updatedGame?.rounds
      .flatMap((r) => r.actions)
      .find((a) => a.id === actionId);
    const currentLow = action ? findLowestBid(action.submissions) : null;
    realtime.publish(gameChannel(gameCode), GAME_EVENTS.BID_PLACED, {
      gameCode,
      actionId,
      currentLow,
      game: updatedGame,
    });
  },
};

const hostFinalize: ActionHandler = {
  submissionSchema: hostFinalizeSubmissionSchema,
  crossValidate: validateHostFinalize,
  onPlayerSubmit: async ({ gameCode, roundId, actionId }) => {
    await runHostFinalize({ gameCode, roundId, actionId });
  },
};

const hostConfirmCompletion: ActionHandler = {
  submissionSchema: hostConfirmCompletionSubmissionSchema,
  crossValidate: validateHostConfirmCompletion,
  onPlayerSubmit: async ({ gameCode, roundId, actionId }) => {
    await runHostConfirmCompletion({ gameCode, roundId, actionId });
  },
};

const bidResolveAndScore: ActionHandler = {
  onSystemAdvance: async ({ gameCode, roundId }) => {
    await runBidResolveAndScore({ gameCode, roundId });
  },
};

const declareWinner: ActionHandler = {
  onSystemAdvance: async ({ gameCode, roundId }) => {
    await runDeclareWinnerIfReady({ gameCode, roundId });
  },
};

export const raceToTheBottomHandlers: GameHandlerMap = {
  HOST_PROMPT_SUBMIT: hostPromptSubmit,
  AUCTION_BID: auctionBid,
  HOST_FINALIZE: hostFinalize,
  HOST_CONFIRM_COMPLETION: hostConfirmCompletion,
  BID_RESOLVE_AND_SCORE: bidResolveAndScore,
  DECLARE_WINNER: declareWinner,
};

export * from "./submissions";
