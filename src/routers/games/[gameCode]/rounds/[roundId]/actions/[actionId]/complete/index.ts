import { Router } from "express";

import { HTTP_STATUSES, completeAction } from "../../../../../../../../actions";
import verifyToken from "../../../../../../../../services/auth/verifyToken";

const router = Router({ mergeParams: true });

router.route("/").post(verifyToken, async (req: any, res) => {
  try {
    const {
      user,
      params: { gameCode, roundId, actionId },
    } = req;

    const { status, message } = await completeAction({
      gameCode,
      userId: user.id,
      roundId,
      actionId,
    });

    res.status(status).send({ message });
  } catch (caught: any) {
    console.log(caught);
    const {
      status = HTTP_STATUSES.SERVER_ERROR.INTERNAL_SERVER_ERROR,
      error = "There was an error completing this action",
    } = caught;

    res.status(status).send({ error });
  }
});

export default router;
