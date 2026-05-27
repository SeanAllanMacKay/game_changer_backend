import { SocketIoProvider } from "./socketIoProvider";

import type { Server as HttpServer } from "http";
import type { ChannelAuthorizer, RealtimeProvider } from "./types";

export * from "./types";
export * from "./channels";

export interface InitRealtimeOptions {
  httpServer: HttpServer;
  corsOrigins: string[];
  channelAuthorizer?: ChannelAuthorizer;
}

const provider = new SocketIoProvider();

export function initRealtime(options: InitRealtimeOptions): void {
  provider.init(options.httpServer, {
    corsOrigins: options.corsOrigins,
    channelAuthorizer: options.channelAuthorizer,
  });
}

export const realtime: RealtimeProvider = provider;
