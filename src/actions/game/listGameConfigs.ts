import { selectGameConfigs } from "../../services/db";
import { HTTP_STATUSES } from "../HTTP_STATUSES";

export const listGameConfigs = async () => {
  try {
    const gameConfigs = await selectGameConfigs();

    return {
      status: gameConfigs?.length
        ? HTTP_STATUSES.SUCCESS.OK
        : HTTP_STATUSES.SUCCESS.EMPTY,
      message: "Game configs fetched",
      gameConfigs,
    };
  } catch (caught: any) {
    const {
      status = HTTP_STATUSES.SERVER_ERROR.INTERNAL_SERVER_ERROR,
      error = ["There was an error fetching these game configs"],
    } = caught;

    throw {
      status: status,
      error: error,
    };
  }
};
