import { selectGame, selectUserByDeviceId } from "../../services/db";
import { HTTP_STATUSES } from "../HTTP_STATUSES";
import { resolveViewState } from "./resolveViewState";

export const getGame = async ({
  deviceId,
  gameCode,
}: {
  deviceId: string;
  gameCode: string;
}) => {
  try {
    const user = await selectUserByDeviceId({ deviceId });

    if (!user) {
      throw {
        status: HTTP_STATUSES.CLIENT_ERROR.NOT_FOUND,
        error: ["No user found for this device"],
      };
    }

    const game = await selectGame({ userId: user.id, gameCode });

    if (!game) {
      throw {
        status: HTTP_STATUSES.CLIENT_ERROR.NOT_FOUND,
        error: ["Game not found"],
      };
    }

    const viewState = resolveViewState({ game, userId: user.id });

    return {
      status: HTTP_STATUSES.SUCCESS.OK,
      message: "Game fetched",
      game,
      viewState,
    };
  } catch (caught: any) {
    const {
      status = HTTP_STATUSES.SERVER_ERROR.INTERNAL_SERVER_ERROR,
      error = ["There was an error fetching this game"],
    } = caught;

    throw {
      status,
      error,
    };
  }
};
