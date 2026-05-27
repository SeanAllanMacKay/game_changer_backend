import type { RequestHandler } from "express";

const DEVICE_ID_HEADER = "x-device-id";

// @ts-ignore
const requireDeviceId: RequestHandler = (req, res, next) => {
  const raw = req.header(DEVICE_ID_HEADER);
  const deviceId = typeof raw === "string" ? raw.trim() : "";

  if (!deviceId) {
    return res.status(400).send({ error: "Missing X-Device-Id header" });
  }

  // @ts-ignore
  req.deviceId = deviceId;
  next();
};

export default requireDeviceId;
