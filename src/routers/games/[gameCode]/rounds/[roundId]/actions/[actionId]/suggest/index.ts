import { Router } from "express";

import { HTTP_STATUSES, suggestHostPrompt } from "../../../../../../../../actions";
import verifyToken from "../../../../../../../../services/auth/verifyToken";

const router = Router({ mergeParams: true });

router.route("/").post(verifyToken, async (req: any, res) => {
  try {
    const {
      user,
      params: { gameCode, roundId, actionId },
    } = req;

    const { status, message, prompt } = await suggestHostPrompt({
      gameCode,
      userId: user.id,
      roundId,
      actionId,
    });

    res.status(status).send({ message, prompt });
  } catch (caught: any) {
    console.log(caught);
    const {
      status = HTTP_STATUSES.SERVER_ERROR.INTERNAL_SERVER_ERROR,
      error = "There was an error generating suggestions",
    } = caught;

    res.status(status).send({ error });
  }
});

export default router;
