import { Router } from "express";

import actionsRouter from "./actions";

const router = Router({ mergeParams: true });

router.use("/actions", actionsRouter);

export default router;
