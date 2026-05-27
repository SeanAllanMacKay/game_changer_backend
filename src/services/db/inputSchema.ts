/**
 * `inputSchema` and `payload` are intentionally loose JSON shapes here. The
 * authoritative validation lives per-game, per-action in `src/games/`, looked
 * up at submit time by `(gameConfigName, actionTypeName)`. Adding a new game
 * or input variant does not require changes to this file.
 */

export type ActionInput = Record<string, unknown>;
export type SubmissionPayload = Record<string, unknown>;
