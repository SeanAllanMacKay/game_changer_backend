import { db, markActionOutput, selectGame } from "../../../services/db";
import { GAME_EVENTS, gameChannel, realtime } from "../../../services/realtime";
import { extractDrawingText } from "../submissions";
import { shuffleSubmissions } from "../shuffle";

type RunArgs = {
  gameCode: string;
  roundId: string;
};

/**
 * SYSTEM step that runs once every DRAWING_SUBMISSION row is in. Loads the
 * round's drawings, applies a deterministic shuffle keyed by `roundId`
 * (see `../shuffle.ts`), and writes `{ slotId, drawing }` entries to its
 * own `output.slots`. The `userId` is intentionally omitted from `output`
 * so the host can't tie a slot back to an author; the mapping is
 * re-derivable from `(roundId, DRAWING_SUBMISSION.submissions)`, which
 * `runHostSelectWinner` and `runRevealAndScore` do.
 *
 * Called explicitly from `runDrawingSubmissionIfReady`; also registered as
 * SHUFFLE_DRAWINGS's `onSystemAdvance` in the handler map for symmetry,
 * though the engine never auto-fires non-first SYSTEM actions.
 * Idempotent via `markActionOutput`.
 */
export const runShuffleDrawings = async ({
  gameCode,
  roundId,
}: RunArgs): Promise<void> => {
  const round = await db.query.GameRound.findFirst({
    where: (r, { eq }) => eq(r.id, roundId),
    columns: { status: true },
    with: {
      actions: {
        with: {
          actionType: { columns: { name: true } },
          submissions: {
            columns: { userId: true, payload: true, createdAt: true },
          },
        },
      },
    },
  });
  if (!round) return;
  if (round.status !== "IN_PROGRESS") return;

  const shuffle = round.actions.find(
    (a) => a.actionType.name === "SHUFFLE_DRAWINGS",
  );
  const drawing = round.actions.find(
    (a) => a.actionType.name === "DRAWING_SUBMISSION",
  );
  if (!shuffle || !drawing) return;
  if (shuffle.output !== null) return;
  if (drawing.output === null) return; // wait for `runDrawingSubmissionIfReady` first

  const drawings: { userId: string; payload: unknown; createdAt: Date }[] = [];
  for (const sub of drawing.submissions) {
    let text: string;
    try {
      text = extractDrawingText(sub.payload);
    } catch {
      continue;
    }
    drawings.push({ userId: sub.userId, payload: text, createdAt: sub.createdAt });
  }

  // Zero valid drawings is a degenerate case (every non-host's submission
  // failed to parse); claim the transition with an empty slot list so the
  // round can still advance — `validateHostSelectWinner` will then reject
  // any pick the host attempts, but the round won't hang.
  const slots = shuffleSubmissions<string>(drawings, roundId).map((s) => ({
    slotId: s.slotId,
    drawing: s.payload,
  }));

  const claimed = await markActionOutput({
    actionId: shuffle.id,
    output: { completedAt: new Date().toISOString(), slots },
  });
  if (!claimed) return;

  const updatedGame = await selectGame({ gameCode });
  realtime.publish(gameChannel(gameCode), GAME_EVENTS.ACTION_ADVANCED, {
    gameCode,
    game: updatedGame,
  });
};
