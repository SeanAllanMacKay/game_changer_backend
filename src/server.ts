import express from "express";
import { createServer } from "http";
import bodyParser from "body-parser";
import cors from "cors";
import cookieParser from "cookie-parser";

import routers from "./routers";
import { initRealtime, parseGameChannel } from "./services/realtime";
import { selectUserGame } from "./services/db";

const API_PORT = process.env.PORT ?? process.env.API_PORT ?? 8082;
const FE_ORIGIN = process.env.FE_ORIGIN ?? "localhost:8081";
const COOKIE_SECRET = process.env.COOKIE_SECRET;
const NGROK_DOMAIN = process.env.NGROK_DOMAIN;

// We intentionally log-and-continue rather than exit. Until graceful shutdown
// is in place, exiting on a single stray error would drop every in-flight game
// session. Node would otherwise terminate the process on an unhandled rejection
// (Node >=15 default), so we catch that here too to keep live games alive.
// TODO: once graceful shutdown exists, switch these to a controlled drain+exit
// so the host can restart a known-bad process cleanly instead of limping on.
process.on("uncaughtException", (error) => {
  console.error("UNCAUGHT EXCEPTION — process kept alive:", error);
});

process.on("unhandledRejection", (reason) => {
  console.error("UNHANDLED REJECTION — process kept alive:", reason);
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
    // Dev-only dependency: imported lazily so it isn't required in production
    // (where @ngrok/ngrok isn't installed).
    const { default: ngrok } = await import("@ngrok/ngrok");
    const listener = await ngrok.forward({
      addr: API_PORT,
      domain: NGROK_DOMAIN,
      authtoken_from_env: true,
    });

    console.log(`NGROK ingress established at: ${listener.url()}`);
  })();
}
