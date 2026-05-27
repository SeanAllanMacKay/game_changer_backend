import { Router } from "express";

import { HTTP_STATUSES, submitRound } from "../../../../actions";
import verifyToken from "../../../../services/auth/verifyToken";

const router = Router({ mergeParams: true });

router.route("/").post(verifyToken, async (req: any, res) => {
  try {
    const {
      user,
      params: { gameCode },
      body: { actionId, payload },
    } = req;

    const { status, message, submission } = await submitRound({
      gameCode,
      userId: user.id,
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
