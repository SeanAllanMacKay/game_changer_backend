import { db } from "../services/db";
import { dirtyLaundryHandlers, DIRTY_LAUNDRY_GAME_NAME } from "./dirtyLaundry";
import {
  makeSomeNoiseHandlers,
  MAKE_SOME_NOISE_GAME_NAME,
} from "./makeSomeNoise";
import {
  pencilsDownHandlers,
  PENCILS_DOWN_GAME_NAME,
} from "./pencilsDown";
import {
  raceToTheBottomHandlers,
  RACE_TO_THE_BOTTOM_GAME_NAME,
} from "./raceToTheBottom";
import type { ActionHandler, GameHandlerMap } from "./types";

export * from "./types";

/**
 * Registry of per-game-per-action handlers. Looked up by
 * `(GameConfig.name, GameRoundActionType.name)` and consulted by the engine
 * (`submitRound`, `advanceRoundIfComplete`, `startGame`) to validate
 * payloads, run cross-state checks, and trigger SYSTEM-side advancement.
 * Add a new entry here when a game template is added.
 */
export const GAME_HANDLERS: Record<string, GameHandlerMap> = {
  [DIRTY_LAUNDRY_GAME_NAME]: dirtyLaundryHandlers,
  [RACE_TO_THE_BOTTOM_GAME_NAME]: raceToTheBottomHandlers,
  [MAKE_SOME_NOISE_GAME_NAME]: makeSomeNoiseHandlers,
  [PENCILS_DOWN_GAME_NAME]: pencilsDownHandlers,
};

export const getActionHandler = (
  gameConfigName: string,
  actionTypeName: string,
): ActionHandler | null => {
  return GAME_HANDLERS[gameConfigName]?.[actionTypeName] ?? null;
};

/**
 * If the first action of `roundId` is a SYSTEM action with a registered
 * `onSystemAdvance` handler, fire it. Called when a round transitions to
 * IN_PROGRESS (either at `startGame` time for round 1, or in
 * `advanceRoundIfComplete` for subsequent rounds). Idempotent at the handler
 * layer via `markActionOutput` CAS.
 */
export const dispatchFirstSystemAction = async ({
  gameCode,
  roundId,
}: {
  gameCode: string;
  roundId: string;
}): Promise<void> => {
  const round = await db.query.GameRound.findFirst({
    where: (r, { eq }) => eq(r.id, roundId),
    with: {
      game: { with: { config: { columns: { name: true } } } },
      actions: {
        with: {
          config: { columns: { order: true } },
          actionType: { columns: { name: true, role: true } },
        },
      },
    },
  });
  if (!round) return;

  const sorted = [...round.actions].sort(
    (a, b) => a.config.order - b.config.order,
  );
  const first = sorted[0];
  if (!first || first.actionType.role !== "SYSTEM") return;

  const handler = getActionHandler(round.game.config.name, first.actionType.name);
  await handler?.onSystemAdvance?.({
    gameCode,
    roundId,
    actionId: first.id,
  });
};
