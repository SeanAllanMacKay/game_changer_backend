import { Router } from "express";

import completeRouter from "./complete";
import suggestRouter from "./suggest";

const router = Router({ mergeParams: true });

router.use("/complete", completeRouter);
router.use("/suggest", suggestRouter);

export default router;
