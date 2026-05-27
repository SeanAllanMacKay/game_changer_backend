import { eq } from "drizzle-orm";

import {
  db,
  GameRound,
  markActionOutput,
  selectGame,
} from "../../../services/db";
import { GAME_EVENTS, gameChannel, realtime } from "../../../services/realtime";
import { extractWinnerId } from "../submissions";
import { runAwardPointAndScore } from "./runAwardPointAndScore";

type RunArgs = {
  gameCode: string;
  roundId: string;
  actionId: string;
};

/**
 * Fires after the host submits HOST_SELECT_WINNER. Closes the open BUZZ_IN
 * action, CAS-marks HOST_SELECT_WINNER's own output, writes the winner onto
 * `GameRound.winnerId`, and chains to `runAwardPointAndScore` to actually
 * grant the point. Mirrors RTTB's runHostConfirmCompletion → runBidResolveAndScore
 * chain.
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

  const buzz = round.actions.find((a) => a.actionType.name === "BUZZ_IN");
  const select = round.actions.find((a) => a.id === actionId);
  if (!buzz || !select) return;

  const selectSubmission = select.submissions[0];
  if (!selectSubmission) return;

  let winnerId: string;
  try {
    winnerId = extractWinnerId(selectSubmission.payload);
  } catch {
    return;
  }

  if (buzz.output === null) {
    await markActionOutput({
      actionId: buzz.id,
      output: { closedAt: new Date().toISOString() },
    });
  }

  const claimed = await markActionOutput({
    actionId: select.id,
    output: { completedAt: new Date().toISOString(), winnerId },
  });
  if (!claimed) return;

  await db
    .update(GameRound)
    .set({ winnerId })
    .where(eq(GameRound.id, roundId));

  const updatedGame = await selectGame({ gameCode });
  realtime.publish(gameChannel(gameCode), GAME_EVENTS.ACTION_ADVANCED, {
    gameCode,
    game: updatedGame,
  });

  await runAwardPointAndScore({ gameCode, roundId });
};
