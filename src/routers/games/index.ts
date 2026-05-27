import { Router } from "express";
import configsRouter from "./configs";
import gameCodeRouter from "./[gameCode]";
import {
  createGame,
  HTTP_STATUSES,
  listUserGames,
} from "../../actions";
import auth from "../../services/auth";
import verifyToken from "../../services/auth/verifyToken";
import requireDeviceId from "../../services/auth/requireDeviceId";

const router = Router({ mergeParams: true });

router
  .route("/")
  .get(requireDeviceId, async (req: any, res) => {
    try {
      const {
        signedCookies: { auth: token },
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

      const { status, message, games, totalItems, totalPages } =
        await listUserGames({ userId, deviceId });

      res.status(status).send({ message, games, totalItems, totalPages });
    } catch (caught: any) {
      console.log(caught);
      const {
        status = HTTP_STATUSES.SERVER_ERROR.INTERNAL_SERVER_ERROR,
        error = "There was an error fetching your games",
      } = caught;

      res.status(status).send({ error });
    }
  })
  .post(requireDeviceId, verifyToken, async (req: any, res) => {
    try {
      const {
        user,
        body: { gameConfigId },
      } = req;

      const { status, message, game } = await createGame({
        userId: user.id,
        gameConfigId,
      });

      res.status(status).send({ message, game });
    } catch (caught: any) {
      console.log(caught);
      const {
        status = HTTP_STATUSES.SERVER_ERROR.INTERNAL_SERVER_ERROR,
        error = "There was an error creating this game",
      } = caught;

      res.status(status).send({ error });
    }
  });

router.use("/configs", configsRouter);
router.use("/:gameCode", gameCodeRouter);

export default router;
