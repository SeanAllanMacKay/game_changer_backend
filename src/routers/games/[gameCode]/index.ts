import { Router } from "express";
import { getGame, HTTP_STATUSES } from "../../../actions";
import auth from "../../../services/auth";
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

    const { status, message, game, viewState } = await getGame({
      userId,
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
