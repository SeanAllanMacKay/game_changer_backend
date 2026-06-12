import { Router } from "express";

import { HTTP_STATUSES, submitRound } from "../../../../actions";
import auth from "../../../../services/auth";
import requireDeviceId from "../../../../services/auth/requireDeviceId";

const router = Router({ mergeParams: true });

router.route("/").post(requireDeviceId, async (req: any, res) => {
  try {
    const {
      params: { gameCode },
      signedCookies: { auth: token },
      body: { actionId, payload },
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

    const { status, message, submission } = await submitRound({
      gameCode,
      userId,
      deviceId,
      actionId,
      payload,
    });

    res.status(status).send({ message, submission });
  } catch (caught: any) {
    console.log(caught);
    const {
      status = HTTP_STATUSES.SERVER_ERROR.INTERNAL_SERVER_ERROR,
      error = "There was an error submitting for this round",
    } = caught;

    res.status(status).send({ error });
  }
});

export default router;
