import * as z from "zod";

import { GameRound, selectGame, startGameInDb } from "../../services/db";
import { GAME_EVENTS, gameChannel, realtime } from "../../services/realtime";
import { dispatchFirstSystemAction } from "../../games";
import { HTTP_STATUSES } from "../HTTP_STATUSES";

const StartGameSchema = z.object({
  gameCode: z.string().min(1),
  userId: z.string().min(1),
});

type StartGameProps = {
  gameCode: string;
  userId: string;
};

export const startGame = async ({ gameCode, userId }: StartGameProps) => {
  try {
    StartGameSchema.parse({ gameCode, userId });

    const game = await selectGame({ userId, gameCode });

    if (!game) {
      throw {
        status: HTTP_STATUSES.CLIENT_ERROR.NOT_FOUND,
        error: ["Game not found"],
      };
    }

    if (game.ownerId !== userId) {
      throw {
        status: HTTP_STATUSES.CLIENT_ERROR.FORBIDDEN,
        error: ["Only the game owner can start this game"],
      };
    }

    if (game.status !== "WAITING") {
      throw {
        status: HTTP_STATUSES.CLIENT_ERROR.CONFLICT,
        error: ["This game has already started"],
      };
    }

    const playerCount = game.players.length;
    const { minPlayers, maxPlayers } = game.config;

    if (minPlayers !== null && playerCount < minPlayers) {
      throw {
        status: HTTP_STATUSES.CLIENT_ERROR.PRECONDITION_FAILED,
        error: [
          `At least ${minPlayers} players are required to start this game`,
        ],
      };
    }

    if (maxPlayers !== null && playerCount > maxPlayers) {
      throw {
        status: HTTP_STATUSES.CLIENT_ERROR.PRECONDITION_FAILED,
        error: [`This game allows at most ${maxPlayers} players`],
      };
    }

    const roundConfigs = [...game.config.roundConfigs].sort(
      (a, b) => a.order - b.order,
    );

    const roundsToInsert: (typeof GameRound.$inferInsert)[] = [];
    let order = 1;
    for (const rc of roundConfigs) {
      if (rc.repeatPerPlayer) {
        for (let i = 0; i < rc.repeatCount; i++) {
          for (const player of game.players) {
            roundsToInsert.push({
              gameCode,
              roundConfigId: rc.id,
              order: order++,
              activePlayerId: player.userId,
            });
          }
        }
      } else {
        for (let i = 0; i < rc.repeatCount; i++) {
          roundsToInsert.push({
            gameCode,
            roundConfigId: rc.id,
            order: order++,
          });
        }
      }
    }

    await startGameInDb({ gameCode, rounds: roundsToInsert });

    const refreshedGame = await selectGame({ userId, gameCode });
    const firstRound = refreshedGame?.rounds.find(
      (r) => r.status === "IN_PROGRESS",
    );
    if (firstRound) {
      await dispatchFirstSystemAction({ gameCode, roundId: firstRound.id });
    }

    const updatedGame = await selectGame({ userId, gameCode });

    realtime.publish(gameChannel(gameCode), GAME_EVENTS.GAME_STARTED, {
      gameCode,
      game: updatedGame,
    });

    return {
      status: HTTP_STATUSES.SUCCESS.OK,
      message: "Game started",
      game: updatedGame,
    };
  } catch (caught: any) {
    if (caught instanceof z.ZodError) {
      throw {
        status: HTTP_STATUSES.CLIENT_ERROR.BAD_REQUEST,
        error: caught.issues.map(({ message }) => message),
      };
    }

    const {
      status = HTTP_STATUSES.SERVER_ERROR.INTERNAL_SERVER_ERROR,
      error = ["There was an error starting this game"],
    } = caught;

    throw { status, error };
  }
};
