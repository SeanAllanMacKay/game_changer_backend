import { Server as SocketIoServer } from "socket.io";

import { authenticateSocket } from "./auth";
import { RESERVED_EVENTS } from "./types";

import type { Server as HttpServer } from "http";
import type { Socket } from "socket.io";
import type {
  ChannelAuthorizer,
  ChannelMember,
  MemberEvent,
  MemberEventHandler,
  RealtimeProvider,
} from "./types";

interface SocketIoInitOptions {
  corsOrigins: string[];
  channelAuthorizer?: ChannelAuthorizer;
}

interface AckResponse {
  ok: boolean;
  error?: string;
  members?: ChannelMember[];
}

type AckCallback = (response: AckResponse) => void;

export class SocketIoProvider implements RealtimeProvider {
  private io: SocketIoServer | null = null;
  private channelAuthorizer: ChannelAuthorizer = () => true;
  private members = new Map<string, Map<string, ChannelMember>>();
  private memberAddedHandlers = new Set<MemberEventHandler>();
  private memberRemovedHandlers = new Set<MemberEventHandler>();

  init(httpServer: HttpServer, options: SocketIoInitOptions): void {
    if (this.io) {
      throw new Error("Realtime provider already initialized");
    }

    if (options.channelAuthorizer) {
      this.channelAuthorizer = options.channelAuthorizer;
    }

    this.io = new SocketIoServer(httpServer, {
      cors: {
        origin: options.corsOrigins,
        credentials: true,
      },
    });

    this.io.use(async (socket, next) => {
      const authData = await authenticateSocket(socket);
      if (!authData) {
        return next(new Error("Unauthorized"));
      }
      socket.data.userId = authData.userId;
      socket.data.user = authData.user;
      socket.data.deviceId = authData.deviceId;
      next();
    });

    this.io.on("connection", (socket) => this.handleConnection(socket));
  }

  publish<T>(channel: string, eventName: string, payload: T): void {
    if (!this.io) throw new Error("Realtime provider not initialized");
    this.io.to(channel).emit(eventName, payload);
  }

  getMembers(channel: string): ChannelMember[] {
    const map = this.members.get(channel);
    return map ? Array.from(map.values()) : [];
  }

  onMemberAdded(handler: MemberEventHandler): () => void {
    this.memberAddedHandlers.add(handler);
    return () => this.memberAddedHandlers.delete(handler);
  }

  onMemberRemoved(handler: MemberEventHandler): () => void {
    this.memberRemovedHandlers.add(handler);
    return () => this.memberRemovedHandlers.delete(handler);
  }

  async close(): Promise<void> {
    if (!this.io) return;
    await new Promise<void>((resolve) => this.io!.close(() => resolve()));
    this.io = null;
    this.members.clear();
  }

  private handleConnection(socket: Socket): void {
    socket.on(
      RESERVED_EVENTS.SUBSCRIBE,
      (channel: unknown, ack?: AckCallback) => {
        void this.handleSubscribe(socket, channel, ack);
      },
    );

    socket.on(
      RESERVED_EVENTS.UNSUBSCRIBE,
      (channel: unknown, ack?: AckCallback) => {
        if (typeof channel !== "string" || !channel) {
          ack?.({ ok: false, error: "Invalid channel" });
          return;
        }
        this.removeMember(socket, channel);
        ack?.({ ok: true });
      },
    );

    socket.on("disconnect", () => {
      const channelsToClean: string[] = [];
      this.members.forEach((channelMembers, channelName) => {
        if (channelMembers.has(socket.id)) {
          channelsToClean.push(channelName);
        }
      });
      channelsToClean.forEach((c) => this.removeMember(socket, c));
    });
  }

  private async handleSubscribe(
    socket: Socket,
    channel: unknown,
    ack?: AckCallback,
  ): Promise<void> {
    if (typeof channel !== "string" || !channel) {
      ack?.({ ok: false, error: "Invalid channel" });
      return;
    }

    const userId = socket.data.userId as string | undefined;
    if (!userId) {
      ack?.({ ok: false, error: "Unauthorized" });
      return;
    }

    try {
      const allowed = await this.channelAuthorizer({ channel, userId });
      if (!allowed) {
        ack?.({ ok: false, error: "Forbidden" });
        return;
      }
    } catch {
      ack?.({ ok: false, error: "Forbidden" });
      return;
    }

    const member: ChannelMember = { userId, socketId: socket.id };

    let channelMembers = this.members.get(channel);
    if (!channelMembers) {
      channelMembers = new Map();
      this.members.set(channel, channelMembers);
    }
    const wasPresent = channelMembers.has(socket.id);
    channelMembers.set(socket.id, member);

    await socket.join(channel);

    if (!wasPresent) {
      socket.to(channel).emit(RESERVED_EVENTS.MEMBER_ADDED, member);
      this.emitMemberEvent(this.memberAddedHandlers, { channel, member });
    }

    ack?.({
      ok: true,
      members: Array.from(channelMembers.values()),
    });
  }

  private removeMember(socket: Socket, channel: string): void {
    const channelMembers = this.members.get(channel);
    if (!channelMembers) return;
    const member = channelMembers.get(socket.id);
    if (!member) return;

    channelMembers.delete(socket.id);
    if (channelMembers.size === 0) {
      this.members.delete(channel);
    }

    socket.leave(channel);
    socket.to(channel).emit(RESERVED_EVENTS.MEMBER_REMOVED, member);
    this.emitMemberEvent(this.memberRemovedHandlers, { channel, member });
  }

  private emitMemberEvent(
    handlers: Set<MemberEventHandler>,
    event: MemberEvent,
  ): void {
    handlers.forEach((handler) => {
      try {
        handler(event);
      } catch (err) {
        console.error("Realtime member event handler threw:", err);
      }
    });
  }
}
