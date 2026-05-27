export type UserId = string;

export interface ChannelMember {
  userId: UserId;
  socketId: string;
}

export interface ChannelAuthorizerParams {
  channel: string;
  userId: UserId;
}

export type ChannelAuthorizer = (
  params: ChannelAuthorizerParams,
) => boolean | Promise<boolean>;

export interface MemberEvent {
  channel: string;
  member: ChannelMember;
}

export type MemberEventHandler = (event: MemberEvent) => void;

export interface RealtimeProvider {
  publish<T = unknown>(channel: string, eventName: string, payload: T): void;
  getMembers(channel: string): ChannelMember[];
  onMemberAdded(handler: MemberEventHandler): () => void;
  onMemberRemoved(handler: MemberEventHandler): () => void;
  close(): Promise<void>;
}

export const RESERVED_EVENTS = {
  SUBSCRIBE: "subscribe",
  UNSUBSCRIBE: "unsubscribe",
  MEMBER_ADDED: "member_added",
  MEMBER_REMOVED: "member_removed",
} as const;
