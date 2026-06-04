import { Router } from "express";
import gamesRouter from "./games";
import usersRouter from "./users";

const router = Router({ mergeParams: true });

// Liveness probe for the host (Railway healthcheck). Intentionally does not
// touch the DB so a transient DB blip doesn't cause restart loops.
router.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", uptime: process.uptime() });
});

router.use("/games", gamesRouter);
router.use("/user", usersRouter);

export default router;
