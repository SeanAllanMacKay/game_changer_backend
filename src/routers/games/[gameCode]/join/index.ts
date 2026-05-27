import { Router } from "express";

import { HTTP_STATUSES, joinGame } from "../../../../actions";
import auth from "../../../../services/auth";
import requireDeviceId from "../../../../services/auth/requireDeviceId";

const router = Router({ mergeParams: true });

router.route("/").post(requireDeviceId, async (req: any, res) => {
  try {
    const {
      params: { gameCode },
      signedCookies: { auth: token },
      body: { name },
      deviceId,
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

    const { status, message, game, user, newToken } = await joinGame({
      gameCode,
      userId,
      name,
      deviceId,
    });

    if (newToken) {
      res.cookie("auth", newToken, {
        httpOnly: true,
        signed: true,
        sameSite: "none",
        secure: true,
      });
    }

    res.status(status).send({ message, game, user });
  } catch (caught: any) {
    console.log(caught);
    const {
      status = HTTP_STATUSES.SERVER_ERROR.INTERNAL_SERVER_ERROR,
      error = "There was an error joining this game",
    } = caught;

    res.status(status).send({ error });
  }
});

export default router;
