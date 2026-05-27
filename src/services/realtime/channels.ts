export const GAME_CHANNEL_PREFIX = "game:";

export const gameChannel = (gameCode: string) =>
  `${GAME_CHANNEL_PREFIX}${gameCode}`;

export const parseGameChannel = (channel: string): string | null => {
  if (!channel.startsWith(GAME_CHANNEL_PREFIX)) return null;
  const gameCode = channel.slice(GAME_CHANNEL_PREFIX.length);
  return gameCode || null;
};

export const GAME_EVENTS = {
  PLAYER_JOINED: "player_joined",
  GAME_STARTED: "game_started",
  ROUND_ADVANCED: "round_advanced",
  ACTION_ADVANCED: "action_advanced",
  SUBMISSION_RECEIVED: "submission_received",
  BID_PLACED: "bid_placed",
  BUZZER_STATE_CHANGED: "buzzer_state_changed",
} as const;

export type GameEvent = (typeof GAME_EVENTS)[keyof typeof GAME_EVENTS];
