import { insertGame, selectGameConfig } from "../../services/db";
import { HTTP_STATUSES } from "../HTTP_STATUSES";

export const createGame = async ({
  userId,
  gameConfigId,
}: {
  userId: string;
  gameConfigId: string;
}) => {
  try {
    const game = await insertGame({ userId, configId: gameConfigId });
    const template = await selectGameConfig({ gameConfigId });

    return {
      status: HTTP_STATUSES.SUCCESS.CREATED,
      message: "Game created",
      game: { ...game, template },
    };
  } catch (caught: any) {
    console.log(caught);
    const {
      status = HTTP_STATUSES.SERVER_ERROR.INTERNAL_SERVER_ERROR,
      error = ["There was an error creating this game"],
    } = caught;

    throw {
      status: status,
      error: error,
    };
  }
};
