import { Router } from "express";

import actionIdRouter from "./[actionId]";

const router = Router({ mergeParams: true });

router.use("/:actionId", actionIdRouter);

export default router;
