import * as z from "zod";
import { desc, eq } from "drizzle-orm";

import { db, GameRoundSubmission } from "../../services/db";

/**
 * Make Some Noise — submission payload schemas.
 *
 * HOST_PROMPT_SUBMIT and HOST_SELECT_WINNER mirror Race to the Bottom's
 * single-field envelope (`{ field: [{ label, text }] }`) so the FE can keep
 * the same generic input rendering. BUZZ_IN intentionally departs from the
 * envelope: the payload is `{ userId: <claimer> | null }` so the "who has
 * the floor right now?" lookup is a one-row read of the latest submission's
 * payload, with no claim/release discriminator to walk.
 */

const fieldEnvelope = z.object({
  field: z
    .array(
      z.object({
        label: z.string().min(1),
        text: z.string(),
      }),
    )
    .length(1),
});

export const hostPromptSubmissionSchema = fieldEnvelope.refine(
  (val) =>
    val.field[0].text.trim().length > 0 && val.field[0].text.length <= 280,
  { message: "Prompt must be between 1 and 280 characters" },
);

export type HostPromptSubmission = z.infer<typeof hostPromptSubmissionSchema>;

export const extractPromptText = (payload: unknown): string => {
  const parsed = hostPromptSubmissionSchema.parse(payload);
  return parsed.field[0].text.trim();
};

/**
 * BUZZ_IN payload. `userId === <submitter>` claims the floor;
 * `userId === null` releases it. The submitter's `GameRoundSubmission.userId`
 * column always identifies who sent the row, regardless of payload contents;
 * the payload userId is the cheap, no-join read for "who holds the floor".
 */
export const buzzSubmissionSchema = z.object({
  userId: z.string().uuid().nullable(),
});

export type BuzzSubmission = z.infer<typeof buzzSubmissionSchema>;

export const tryExtractBuzzUserId = (
  payload: unknown,
): string | null | undefined => {
  const parsed = buzzSubmissionSchema.safeParse(payload);
  if (!parsed.success) return undefined;
  return parsed.data.userId;
};

export const hostSelectWinnerSubmissionSchema = fieldEnvelope.refine(
  (val) => z.string().uuid().safeParse(val.field[0].text.trim()).success,
  { message: "Winner selection must be a valid user id" },
);

export type HostSelectWinnerSubmission = z.infer<
  typeof hostSelectWinnerSubmissionSchema
>;

export const extractWinnerId = (payload: unknown): string => {
  const parsed = hostSelectWinnerSubmissionSchema.parse(payload);
  return parsed.field[0].text.trim();
};

/**
 * Returns the userId of whichever player currently holds the buzzer for
 * `actionId`, or `null` if the floor is free. Reads the most recent
 * submission and returns its payload `userId` — no walking, because the
 * payload's `userId` is already the desired value (claimer or null).
 *
 * Used by `validateBuzz` (to enforce the exclusive-lock + one-buzz rules)
 * and the realtime publisher in the BUZZ_IN handler — both contexts where
 * we don't have submissions in memory yet. `resolveViewState` uses the
 * sync `findActiveBuzzer` against its already-loaded submissions instead.
 */
export const computeActiveBuzzer = async ({
  actionId,
}: {
  actionId: string;
}): Promise<string | null> => {
  const [latest] = await db
    .select({ payload: GameRoundSubmission.payload })
    .from(GameRoundSubmission)
    .where(eq(GameRoundSubmission.actionId, actionId))
    .orderBy(desc(GameRoundSubmission.createdAt))
    .limit(1);

  if (!latest) return null;
  const value = tryExtractBuzzUserId(latest.payload);
  if (value === undefined) return null;
  return value;
};

/**
 * In-memory equivalent of `computeActiveBuzzer` for callers that already
 * have the submissions loaded (resolveViewState). Mirrors the shape of
 * `findLowestBid` in raceToTheBottom/submissions.ts.
 */
export const findActiveBuzzer = (
  submissions: ReadonlyArray<{ payload: unknown; createdAt: Date }>,
): string | null => {
  let latest: { payload: unknown; createdAt: Date } | null = null;
  for (const sub of submissions) {
    if (!latest || sub.createdAt > latest.createdAt) {
      latest = sub;
    }
  }
  if (!latest) return null;
  const value = tryExtractBuzzUserId(latest.payload);
  if (value === undefined) return null;
  return value;
};

/**
 * Returns the userIds of players who have claimed the buzzer this round,
 * in order of their first claim. Used by `resolveViewState` to populate
 * the host's winner picker. In-memory equivalent of `findUsersWhoClaimed`.
 */
export const findClaimedUserIds = (
  submissions: ReadonlyArray<{ payload: unknown; createdAt: Date }>,
): string[] => {
  const ordered = [...submissions].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );
  const seen = new Set<string>();
  const result: string[] = [];
  for (const sub of ordered) {
    const value = tryExtractBuzzUserId(sub.payload);
    if (value === undefined || value === null) continue;
    if (seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
};

/**
 * Returns the set of user ids who have claimed the buzzer (at any point) on
 * this action. Used by `validateBuzz` to enforce the "one buzz per player
 * per prompt" rule.
 */
export const findUsersWhoClaimed = async ({
  actionId,
}: {
  actionId: string;
}): Promise<Set<string>> => {
  const rows = await db
    .select({ payload: GameRoundSubmission.payload })
    .from(GameRoundSubmission)
    .where(eq(GameRoundSubmission.actionId, actionId));

  const claimed = new Set<string>();
  for (const row of rows) {
    const value = tryExtractBuzzUserId(row.payload);
    if (value === undefined || value === null) continue;
    claimed.add(value);
  }
  return claimed;
};

export const makeSomeNoiseSubmissionSchemas = {
  HOST_PROMPT_SUBMIT: hostPromptSubmissionSchema,
  BUZZ_IN: buzzSubmissionSchema,
  HOST_SELECT_WINNER: hostSelectWinnerSubmissionSchema,
} as const;

export type MakeSomeNoiseActionTypeName =
  keyof typeof makeSomeNoiseSubmissionSchemas;
