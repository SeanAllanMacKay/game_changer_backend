import { Router } from "express";
import { getGame, HTTP_STATUSES } from "../../../actions";
import requireDeviceId from "../../../services/auth/requireDeviceId";
import joinRouter from "./join";
import roundsRouter from "./rounds";
import startRouter from "./start";
import submitRouter from "./submit";

const router = Router({ mergeParams: true });

router.use("/join", joinRouter);
router.use("/rounds", roundsRouter);
router.use("/start", startRouter);
router.use("/submit", submitRouter);

router.route("/").get(requireDeviceId, async (req: any, res) => {
  try {
    const {
      deviceId,
      params: { gameCode },
    } = req;

    const { status, message, game, viewState } = await getGame({
      deviceId,
      gameCode,
    });

    res.status(status).send({ message, game, viewState });
  } catch (caught: any) {
    console.log(caught);
    const {
      status = HTTP_STATUSES.SERVER_ERROR.INTERNAL_SERVER_ERROR,
      error = "There was an error creating this game",
    } = caught;

    res.status(status).send({ error });
  }
});

export default router;
