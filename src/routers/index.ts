import { Router } from "express";
import gamesRouter from "./games";
import usersRouter from "./users";

const router = Router({ mergeParams: true });

router.use("/games", gamesRouter);
router.use("/user", usersRouter);

export default router;
