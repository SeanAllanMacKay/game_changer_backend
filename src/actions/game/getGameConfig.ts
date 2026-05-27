import { selectGameConfig } from "../../services/db";
import { HTTP_STATUSES } from "../HTTP_STATUSES";

export const getGameConfig = async ({
  gameConfigId,
}: {
  gameConfigId: string;
}) => {
  try {
    const gameConfig = await selectGameConfig({ gameConfigId });

    return {
      status: HTTP_STATUSES.SUCCESS.OK,
      message: "Game config fetched",
      gameConfig,
    };
  } catch (caught: any) {
    const {
      status = HTTP_STATUSES.SERVER_ERROR.INTERNAL_SERVER_ERROR,
      error = ["There was an error fetching this game config"],
    } = caught;

    throw {
      status: status,
      error: error,
    };
  }
};
