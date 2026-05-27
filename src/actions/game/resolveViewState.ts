import { z } from "zod";

import {
  findActiveBuzzer,
  findClaimedUserIds,
} from "../../games/makeSomeNoise/submissions";
import { findLowestBid } from "../../games/raceToTheBottom/submissions";
import type { selectGame } from "../../services/db/queries/select/selectGame";
import type { ActionInput } from "../../services/db/inputSchema";

type Game = NonNullable<Awaited<ReturnType<typeof selectGame>>>;
type Round = Game["rounds"][number];
type Action = Round["actions"][number];

export type ViewPhase = "lobby" | "setup" | "play" | "results";
export type NextAction = "start_game" | "submit" | "wait" | null;

export type ViewState = {
  phase: ViewPhase;
  you: {
    isHost: boolean;
    isActivePlayer: boolean;
    hasSubmittedCurrent: boolean;
    nextAction: NextAction;
  };
  currentRound: {
    id: string;
    order: number;
    status: Round["status"];
    promptText: string | null;
  } | null;
  currentAction: {
    id: string;
    name: string;
    role: "SYSTEM" | "HOST" | "PLAYER";
    description: string;
    inputSchema: ActionInput | null;
    revealedUserId: string | null;
    currentLow: { amount: number; userId: string } | null;
    activeBuzzer: string | null;
    buzzers: string[];
  } | null;
  submissionProgress: { submitted: number; total: number } | null;
};

const revealAndScoreOutputSchema = z.object({
  authorUserId: z.string(),
});

const resolveRevealedUserId = (
  round: Round,
  currentAction: Action,
): string | null => {
  if (currentAction.config.actionType.name !== "SHOW_STANDINGS") return null;
  const reveal = round.actions.find(
    (a) => a.config.actionType.name === "REVEAL_AND_SCORE",
  );
  if (!reveal?.output) return null;
  const parsed = revealAndScoreOutputSchema.safeParse(reveal.output);
  return parsed.success ? parsed.data.authorUserId : null;
};

const resolveCurrentLow = (
  currentAction: Action,
): { amount: number; userId: string } | null => {
  if (currentAction.config.actionType.name !== "AUCTION_BID") return null;
  return findLowestBid(currentAction.submissions ?? []);
};

const resolveActiveBuzzer = (currentAction: Action): string | null => {
  if (currentAction.config.actionType.name !== "BUZZ_IN") return null;
  return findActiveBuzzer(currentAction.submissions ?? []);
};

// Round-scoped, not action-scoped: populated whenever the current round
// has a BUZZ_IN action, regardless of which action is currently open.
// During BUZZ_IN it tracks claims as they come in; during HOST_SELECT_WINNER
// it powers the host's winner picker (since the BUZZ_IN action is closed
// by then and `activeBuzzer` is null).
const resolveBuzzers = (round: Round): string[] => {
  const buzz = round.actions.find(
    (a) => a.config.actionType.name === "BUZZ_IN",
  );
  if (!buzz) return [];
  return findClaimedUserIds(buzz.submissions ?? []);
};

const PHASE_BY_ROUND_PHASE: Record<"SETUP" | "PLAY" | "RESULTS", ViewPhase> = {
  SETUP: "setup",
  PLAY: "play",
  RESULTS: "results",
};

const pickCurrentRound = (rounds: Round[]): Round | null => {
  const ordered = [...rounds].sort((a, b) => a.order - b.order);
  return (
    ordered.find((r) => r.status === "IN_PROGRESS") ??
    ordered.find((r) => r.status === "PENDING") ??
    null
  );
};

// `GameRoundAction` has no status column; we treat `output === null` as
// "not yet resolved". This matches how submitRound is expected to populate
// `output` once an action's submissions are tallied.
const pickCurrentAction = (round: Round): Action | null => {
  const ordered = [...round.actions].sort(
    (a, b) => a.config.order - b.config.order,
  );
  return ordered.find((a) => a.output === null) ?? null;
};

export const resolveViewState = ({
  game,
  userId,
}: {
  game: Game;
  userId: string;
}): ViewState => {
  const isOwner = game.ownerId === userId;
  const emptyYou = {
    isHost: isOwner,
    isActivePlayer: false,
    hasSubmittedCurrent: false,
    nextAction: null as NextAction,
  };

  if (game.status === "WAITING") {
    return {
      phase: "lobby",
      you: { ...emptyYou, nextAction: isOwner ? "start_game" : "wait" },
      currentRound: null,
      currentAction: null,
      submissionProgress: null,
    };
  }

  if (game.status === "COMPLETED" || game.status === "ABANDONED") {
    return {
      phase: "results",
      you: emptyYou,
      currentRound: null,
      currentAction: null,
      submissionProgress: null,
    };
  }

  const currentRound = pickCurrentRound(game.rounds);
  if (!currentRound) {
    // IN_PROGRESS / PAUSED with no resolvable round — surface as results so
    // the FE doesn't get stuck on an empty play screen.
    return {
      phase: "results",
      you: emptyYou,
      currentRound: null,
      currentAction: null,
      submissionProgress: null,
    };
  }

  const phase = PHASE_BY_ROUND_PHASE[currentRound.roundConfig.phase];
  const currentAction = pickCurrentAction(currentRound);
  const isActivePlayer = currentRound.activePlayerId === userId;
  // For RTB-style rounds (rotating `activePlayerId`), the round host is
  // that player. For Dirty Laundry-style rounds (no `activePlayerId`),
  // the game owner drives HOST actions. The FE reads `isHost` to decide
  // who can submit HOST-role actions, so it must reflect the round host
  // — not the game owner — when a rotation is in effect.
  const isHost = currentRound.activePlayerId ? isActivePlayer : isOwner;

  if (!currentAction) {
    return {
      phase,
      you: { ...emptyYou, isHost, isActivePlayer, nextAction: "wait" },
      currentRound: {
        id: currentRound.id,
        order: currentRound.order,
        status: currentRound.status,
        promptText: currentRound.promptText,
      },
      currentAction: null,
      submissionProgress: null,
    };
  }

  const revealedUserId = resolveRevealedUserId(currentRound, currentAction);

  const role = currentAction.config.actionType.role;
  const submissions = currentAction.submissions ?? [];
  const hasSubmittedCurrent = submissions.some((s) => s.userId === userId);

  let nextAction: NextAction = "wait";
  if (role === "PLAYER") {
    nextAction = hasSubmittedCurrent ? "wait" : "submit";
  } else if (role === "HOST") {
    nextAction = isHost && !hasSubmittedCurrent ? "submit" : "wait";
  }

  let submissionProgress: ViewState["submissionProgress"] = null;
  if (role === "PLAYER") {
    // If the round contains any HOST-role action, the active player is a
    // "host" who doesn't submit player responses (e.g. Race to the Bottom:
    // the host writes the prompt but doesn't bid). Exclude them from the
    // expected total. Dirty Laundry has no HOST-role actions, so this is
    // a no-op there.
    const roundHasHostAction = currentRound.actions.some(
      (a) => a.config.actionType.role === "HOST",
    );
    const total =
      roundHasHostAction && currentRound.activePlayerId
        ? Math.max(0, game.players.length - 1)
        : game.players.length;
    submissionProgress = { submitted: submissions.length, total };
  } else if (role === "HOST") {
    submissionProgress = { submitted: submissions.length, total: 1 };
  }

  return {
    phase,
    you: { isHost, isActivePlayer, hasSubmittedCurrent, nextAction },
    currentRound: {
      id: currentRound.id,
      order: currentRound.order,
      status: currentRound.status,
      promptText: currentRound.promptText,
    },
    currentAction: {
      id: currentAction.id,
      name: currentAction.config.actionType.name,
      role,
      description: currentAction.config.description,
      inputSchema: currentAction.inputSchema,
      revealedUserId,
      currentLow: resolveCurrentLow(currentAction),
      activeBuzzer: resolveActiveBuzzer(currentAction),
      buzzers: resolveBuzzers(currentRound),
    },
    submissionProgress,
  };
};
