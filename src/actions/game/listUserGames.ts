import { selectUserByDeviceId, selectUserGames } from "../../services/db";
import { HTTP_STATUSES } from "../HTTP_STATUSES";

type ListUserGamesProps = {
  userId?: string;
  deviceId: string;
};

export const listUserGames = async ({
  userId,
  deviceId,
}: ListUserGamesProps) => {
  try {
    let resolvedUserId = userId;

    if (!resolvedUserId) {
      const guest = await selectUserByDeviceId({ deviceId });

      if (!guest) {
        return {
          status: HTTP_STATUSES.SUCCESS.OK,
          message: "No games found",
          games: [],
          totalItems: 0,
          totalPages: 0,
        };
      }

      resolvedUserId = guest.id;
    }

    const { projects, totalItems, totalPages } = await selectUserGames({
      userId: resolvedUserId,
    });

    return {
      status: HTTP_STATUSES.SUCCESS.OK,
      message: "Games fetched",
      games: projects,
      totalItems,
      totalPages,
    };
  } catch (caught: any) {
    const {
      status = HTTP_STATUSES.SERVER_ERROR.INTERNAL_SERVER_ERROR,
      error = ["There was an error fetching your games"],
    } = caught;

    throw { status, error };
  }
};
