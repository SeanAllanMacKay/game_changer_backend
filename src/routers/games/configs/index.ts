import { Router } from "express";
import { getGameConfig, HTTP_STATUSES, listGameConfigs } from "../../../actions";

const router = Router({ mergeParams: true });

router.route("/").get(async (req: any, res) => {
  try {
    const { status, message, gameConfigs } = await listGameConfigs();

    res.status(status).send({ message, gameConfigs });
  } catch (caught: any) {
    const {
      status = HTTP_STATUSES.SERVER_ERROR.INTERNAL_SERVER_ERROR,
      error = "There was an error fetching these games",
    } = caught;

    res.status(status).send({ error });
  }
});

router.route("/:gameConfigId").get(async (req: any, res) => {
  try {
    const { gameConfigId } = req.params;

    const { status, message, gameConfig } = await getGameConfig({
      gameConfigId,
    });

    res.status(status).send({ message, gameConfig });
  } catch (caught: any) {
    const {
      status = HTTP_STATUSES.SERVER_ERROR.INTERNAL_SERVER_ERROR,
      error = "There was an error fetching this game config",
    } = caught;

    res.status(status).send({ error });
  }
});

export default router;
