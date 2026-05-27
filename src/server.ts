import express from "express";
import { createServer } from "http";
import bodyParser from "body-parser";
import cors from "cors";
import cookieParser from "cookie-parser";
import ngrok from "@ngrok/ngrok";

import routers from "./routers";
import { initRealtime, parseGameChannel } from "./services/realtime";
import { selectUserGame } from "./services/db";

const API_PORT = process.env.API_PORT ?? 8082;
const FE_ORIGIN = process.env.FE_ORIGIN ?? "localhost:8081";
const COOKIE_SECRET = process.env.COOKIE_SECRET;
const NGROK_DOMAIN = process.env.NGROK_DOMAIN;

process.on("uncaughtException", (error) => {
  console.error("UNCAUGHT ERROR", error);
});

const app = express();

app.use(
  cors({
    credentials: true,
    origin: [`http://${FE_ORIGIN}`, `https://${FE_ORIGIN}`],
  }),
);
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser(COOKIE_SECRET));

const server = createServer(app);

initRealtime({
  httpServer: server,
  corsOrigins: [`http://${FE_ORIGIN}`, `https://${FE_ORIGIN}`],
  channelAuthorizer: async ({ channel, userId }) => {
    const gameCode = parseGameChannel(channel);
    if (!gameCode) return false;

    const membership = await selectUserGame({ userId, gameCode });
    return !!membership;
  },
});

server.listen(API_PORT, () => {
  console.log(`Server online: connected to port ${API_PORT}`);
  console.log(`Accepting requests from ${FE_ORIGIN}`);

  app.use("/api", routers);
});

if (process.env.NODE_ENV === "development") {
  (async () => {
    const listener = await ngrok.forward({
      addr: API_PORT,
      domain: NGROK_DOMAIN,
      authtoken_from_env: true,
    });

    console.log(`NGROK ingress established at: ${listener.url()}`);
  })();
}
