import { Router } from "express";

import { HTTP_STATUSES, startGame } from "../../../../actions";
import verifyToken from "../../../../services/auth/verifyToken";

const router = Router({ mergeParams: true });

router.route("/").post(verifyToken, async (req: any, res) => {
  try {
    const {
      user,
      params: { gameCode },
    } = req;

    const { status, message, game } = await startGame({
      gameCode,
      userId: user.id,
    });

    res.status(status).send({ message, game });
  } catch (caught: any) {
    console.log(caught);
    const {
      status = HTTP_STATUSES.SERVER_ERROR.INTERNAL_SERVER_ERROR,
      error = "There was an error starting this game",
    } = caught;

    res.status(status).send({ error });
  }
});

export default router;
