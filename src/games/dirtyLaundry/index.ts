import { eq } from "drizzle-orm";

import { db, UserGame } from "../../services/db";
import { runAiTransformIfReady } from "../../actions/game/runAiTransformIfReady";
import { runVoteTallyIfReady } from "../../actions/game/runVoteTallyIfReady";
import { runRevealAndScoreIfReady } from "../../actions/game/runRevealAndScoreIfReady";
import { runPromptSelectIfReady } from "../../actions/game/runPromptSelectIfReady";
import { runDeclareWinnerIfReady } from "../../actions/game/runDeclareWinnerIfReady";
import type { ActionHandler, GameHandlerMap } from "../types";
import {
  truthsSubmissionSchema,
  validateVoteAgainstGame,
  voteSubmissionSchema,
} from "./submissions";

export const DIRTY_LAUNDRY_GAME_NAME = "Dirty Laundry";

const textSubmission: ActionHandler = {
  submissionSchema: truthsSubmissionSchema,
  onPlayerSubmit: async ({ gameCode, roundId, actionId }) => {
    await runAiTransformIfReady({
      gameCode,
      roundId,
      submittedActionId: actionId,
    });
  },
};

const deliberateAndVote: ActionHandler = {
  submissionSchema: voteSubmissionSchema,
  crossValidate: async (payload, { gameCode, userId }) => {
    const vote = voteSubmissionSchema.parse(payload);
    const players = await db
      .select({ userId: UserGame.userId })
      .from(UserGame)
      .where(eq(UserGame.gameCode, gameCode));
    validateVoteAgainstGame(vote, {
      voterUserId: userId,
      playerUserIds: players.map((p) => p.userId),
    });
  },
  onPlayerSubmit: async ({ gameCode, roundId, actionId }) => {
    await runVoteTallyIfReady({
      gameCode,
      roundId,
      submittedActionId: actionId,
    });
  },
};

const promptSelect: ActionHandler = {
  onSystemAdvance: async ({ gameCode, roundId }) => {
    await runPromptSelectIfReady({ gameCode, roundId });
  },
};

const revealAndScore: ActionHandler = {
  onSystemAdvance: async ({ gameCode, roundId }) => {
    await runRevealAndScoreIfReady({ gameCode, roundId });
  },
};

const declareWinner: ActionHandler = {
  onSystemAdvance: async ({ gameCode, roundId }) => {
    await runDeclareWinnerIfReady({ gameCode, roundId });
  },
};

export const dirtyLaundryHandlers: GameHandlerMap = {
  TEXT_SUBMISSION: textSubmission,
  DELIBERATE_AND_VOTE: deliberateAndVote,
  PROMPT_SELECT: promptSelect,
  REVEAL_AND_SCORE: revealAndScore,
  DECLARE_WINNER: declareWinner,
};
