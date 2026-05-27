import type { z } from "zod";

/**
 * Per-game, per-action-type runtime hooks. Looked up by `submitRound`,
 * `advanceRoundIfComplete`, and `startGame` at request time using
 * `(GameConfig.name, GameRoundActionType.name)`. Keep these hooks free of
 * game-specific imports inside the engine layer — register them from a
 * game's own folder under `src/games/<name>/`.
 */
export type ActionHandlerContext = {
  gameCode: string;
  roundId: string;
  actionId: string;
  userId: string;
};

export type SystemAdvanceContext = Omit<ActionHandlerContext, "userId">;

export type ActionHandler = {
  /**
   * Zod schema used by `submitRound` to validate the request payload.
   * Required for PLAYER / HOST action types.
   */
  submissionSchema?: z.ZodTypeAny;

  /**
   * Cross-state checks that the schema alone can't express (e.g. "voter
   * isn't voting for themselves", "bid is lower than the current low",
   * "submitter is the round's active host"). Runs after the schema parses
   * and before the row is inserted. Throw `{ status, error }` on failure.
   */
  crossValidate?: (
    payload: unknown,
    ctx: ActionHandlerContext,
  ) => void | Promise<void>;

  /**
   * If true, multiple `GameRoundSubmission` rows per (user, action) are
   * permitted. `submitRound` skips its application-level uniqueness check
   * for this action type. Used for live-auction bidding.
   */
  allowMultipleSubmissions?: boolean;

  /**
   * If true, `selectGame` exposes the full `payload` and `createdAt` of
   * every submission on this action to every player in the game. Default
   * (false) keeps the existing privacy posture: only the submitter's
   * `userId` is leaked, never the payload. Set this for actions whose
   * submissions are intentionally visible (e.g. live-auction bids).
   */
  publicSubmissions?: boolean;

  /**
   * Fires after a PLAYER or HOST submission is recorded. Replaces the
   * previously hard-coded `runAiTransformIfReady` / `runVoteTallyIfReady`
   * calls at the bottom of `submitRound`. Handlers are responsible for
   * deciding whether to advance the action (typically by checking
   * "all expected submissions in" and CAS-writing the action's `output`).
   */
  onPlayerSubmit?: (ctx: ActionHandlerContext) => Promise<void>;

  /**
   * Fires when a SYSTEM action becomes the first action of a newly-started
   * round (or the first round of a newly-started game). Replaces the
   * hard-coded `runPromptSelectIfReady` / `runDeclareWinnerIfReady` calls
   * in `advanceRoundIfComplete`. Handlers do their work and CAS-write the
   * action's `output`.
   */
  onSystemAdvance?: (ctx: SystemAdvanceContext) => Promise<void>;
};

export type GameHandlerMap = Record<string, ActionHandler>;
