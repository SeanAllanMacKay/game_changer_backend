import { Router } from "express";

import { HTTP_STATUSES, listGameRounds } from "../../../../actions";
import requireDeviceId from "../../../../services/auth/requireDeviceId";
import roundIdRouter from "./[roundId]";

const router = Router({ mergeParams: true });

router.use("/:roundId", roundIdRouter);

router.route("/").get(requireDeviceId, async (req: any, res) => {
  try {
    const {
      deviceId,
      params: { gameCode },
    } = req;

    const { status, message, rounds } = await listGameRounds({
      deviceId,
      gameCode,
    });

    res.status(status).send({ message, rounds });
  } catch (caught: any) {
    console.log(caught);
    const {
      status = HTTP_STATUSES.SERVER_ERROR.INTERNAL_SERVER_ERROR,
      error = "There was an error fetching the rounds for this game",
    } = caught;

    res.status(status).send({ error });
  }
});

export default router;
