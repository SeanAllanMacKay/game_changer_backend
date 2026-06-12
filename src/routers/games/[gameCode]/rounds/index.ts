import { Router } from "express";

import { HTTP_STATUSES, listGameRounds } from "../../../../actions";
import auth from "../../../../services/auth";
import requireDeviceId from "../../../../services/auth/requireDeviceId";
import roundIdRouter from "./[roundId]";

const router = Router({ mergeParams: true });

router.use("/:roundId", roundIdRouter);

router.route("/").get(requireDeviceId, async (req: any, res) => {
  try {
    const {
      signedCookies: { auth: token },
      deviceId,
      params: { gameCode },
    } = req;

    let userId: string | undefined;

    if (token) {
      const verifiedToken = (await auth.verify(token)) as
        | { id: string }
        | false;

      if (verifiedToken) {
        userId = verifiedToken.id;
      }
    }

    const { status, message, rounds } = await listGameRounds({
      userId,
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
