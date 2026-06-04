import { runDeclareWinnerIfReady } from "../../actions/game/runDeclareWinnerIfReady";
import type { ActionHandler, GameHandlerMap } from "../types";
import { runDrawingSubmissionIfReady } from "./handlers/runDrawingSubmissionIfReady";
import { runHostPromptSubmit } from "./handlers/runHostPromptSubmit";
import { runHostSelectWinner } from "./handlers/runHostSelectWinner";
import { runRevealAndScore } from "./handlers/runRevealAndScore";
import { runShuffleDrawings } from "./handlers/runShuffleDrawings";
import {
  drawingSubmissionSchema,
  hostPromptSubmissionSchema,
  hostSelectWinnerSubmissionSchema,
} from "./submissions";
import {
  validateDrawing,
  validateHostPrompt,
  validateHostSelectWinner,
} from "./validators";

export const PENCILS_DOWN_GAME_NAME = "Pencils Down";

const hostPromptSubmit: ActionHandler = {
  submissionSchema: hostPromptSubmissionSchema,
  crossValidate: validateHostPrompt,
  onPlayerSubmit: async ({ gameCode, roundId, actionId }) => {
    await runHostPromptSubmit({ gameCode, roundId, actionId });
  },
};

const drawingSubmission: ActionHandler = {
  submissionSchema: drawingSubmissionSchema,
  crossValidate: validateDrawing,
  onPlayerSubmit: async ({ gameCode, roundId, actionId }) => {
    await runDrawingSubmissionIfReady({ gameCode, roundId, actionId });
  },
};

// `onSystemAdvance` is registered for symmetry, but the engine only auto-
// fires SYSTEM actions that are the FIRST action of a newly-started round
// (see `dispatchFirstSystemAction` in `src/games/index.ts`). SHUFFLE_DRAWINGS
// is action #3 of the gameplay round, so it's actually triggered by
// `runDrawingSubmissionIfReady` calling `runShuffleDrawings` directly.
const shuffleDrawings: ActionHandler = {
  onSystemAdvance: async ({ gameCode, roundId }) => {
    await runShuffleDrawings({ gameCode, roundId });
  },
};

const hostSelectWinner: ActionHandler = {
  submissionSchema: hostSelectWinnerSubmissionSchema,
  crossValidate: validateHostSelectWinner,
  onPlayerSubmit: async ({ gameCode, roundId, actionId }) => {
    await runHostSelectWinner({ gameCode, roundId, actionId });
  },
};

// Same caveat as SHUFFLE_DRAWINGS — fired explicitly from
// `runHostSelectWinner`, not via the engine's first-action dispatch.
const revealAndScore: ActionHandler = {
  onSystemAdvance: async ({ gameCode, roundId }) => {
    await runRevealAndScore({ gameCode, roundId });
  },
};

const declareWinner: ActionHandler = {
  onSystemAdvance: async ({ gameCode, roundId }) => {
    await runDeclareWinnerIfReady({ gameCode, roundId });
  },
};

export const pencilsDownHandlers: GameHandlerMap = {
  HOST_PROMPT_SUBMIT: hostPromptSubmit,
  DRAWING_SUBMISSION: drawingSubmission,
  SHUFFLE_DRAWINGS: shuffleDrawings,
  HOST_SELECT_WINNER: hostSelectWinner,
  REVEAL_AND_SCORE: revealAndScore,
  DECLARE_WINNER: declareWinner,
};

export * from "./submissions";
