import {
  selectGameRounds,
  selectUserByDeviceId,
  selectUserGame,
} from "../../services/db";
import { HTTP_STATUSES } from "../HTTP_STATUSES";

export const listGameRounds = async ({
  userId,
  deviceId,
  gameCode,
}: {
  userId?: string;
  deviceId: string;
  gameCode: string;
}) => {
  try {
    let resolvedUserId = userId;

    if (!resolvedUserId) {
      const guest = await selectUserByDeviceId({ deviceId });

      if (!guest) {
        throw {
          status: HTTP_STATUSES.CLIENT_ERROR.NOT_FOUND,
          error: ["No user found for this device"],
        };
      }

      resolvedUserId = guest.id;
    }

    const userGame = await selectUserGame({ userId: resolvedUserId, gameCode });

    if (!userGame) {
      throw {
        status: HTTP_STATUSES.CLIENT_ERROR.NOT_FOUND,
        error: ["Game not found"],
      };
    }

    const rounds = await selectGameRounds({ gameCode });

    return {
      status: HTTP_STATUSES.SUCCESS.OK,
      message: "Game rounds fetched",
      rounds,
    };
  } catch (caught: any) {
    const {
      status = HTTP_STATUSES.SERVER_ERROR.INTERNAL_SERVER_ERROR,
      error = ["There was an error fetching the rounds for this game"],
    } = caught;

    throw {
      status,
      error,
    };
  }
};
