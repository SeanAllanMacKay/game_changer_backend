import { eq } from "drizzle-orm";

import {
  db,
  GameRound,
  markActionOutput,
  selectGame,
} from "../../../services/db";
import { GAME_EVENTS, gameChannel, realtime } from "../../../services/realtime";
import { extractWinningSlotId } from "../submissions";
import { shuffleSubmissions } from "../shuffle";
import { runRevealAndScore } from "./runRevealAndScore";

type RunArgs = {
  gameCode: string;
  roundId: string;
  actionId: string;
};

/**
 * Fires after the host submits HOST_SELECT_WINNER. Reads the picked slotId,
 * re-derives the slot → userId mapping from the (private) DRAWING_SUBMISSION
 * submissions using the same deterministic shuffle as `runShuffleDrawings`,
 * CAS-marks HOST_SELECT_WINNER's own output, writes the winner onto
 * `GameRound.winnerId`, and chains to `runRevealAndScore`.
 *
 * Mirrors `makeSomeNoise/handlers/runHostSelectWinner.ts`, but the host
 * picks a slotId rather than a userId — the userId stays hidden until
 * REVEAL_AND_SCORE runs.
 *
 * Idempotent: every write is CAS-guarded via `markActionOutput`.
 */
export const runHostSelectWinner = async ({
  gameCode,
  roundId,
  actionId,
}: RunArgs): Promise<void> => {
  const round = await db.query.GameRound.findFirst({
    where: (r, { eq }) => eq(r.id, roundId),
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

  const select = round.actions.find((a) => a.id === actionId);
  const drawing = round.actions.find(
    (a) => a.actionType.name === "DRAWING_SUBMISSION",
  );
  if (!select || !drawing) return;

  const selectSubmission = select.submissions[0];
  if (!selectSubmission) return;

  let winningSlotId: string;
  try {
    winningSlotId = extractWinningSlotId(selectSubmission.payload);
  } catch {
    return;
  }

  const mapping = shuffleSubmissions(drawing.submissions, roundId);
  const winnerSlot = mapping.find((s) => s.slotId === winningSlotId);
  if (!winnerSlot) return;
  const winnerUserId = winnerSlot.userId;

  const claimed = await markActionOutput({
    actionId: select.id,
    output: {
      completedAt: new Date().toISOString(),
      winningSlotId,
      winnerUserId,
    },
  });
  if (!claimed) return;

  await db
    .update(GameRound)
    .set({ winnerId: winnerUserId })
    .where(eq(GameRound.id, roundId));

  const updatedGame = await selectGame({ gameCode });
  realtime.publish(gameChannel(gameCode), GAME_EVENTS.ACTION_ADVANCED, {
    gameCode,
    game: updatedGame,
  });

  await runRevealAndScore({ gameCode, roundId });
};
