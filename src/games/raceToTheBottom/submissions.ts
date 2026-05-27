import * as z from "zod";

import { HTTP_STATUSES } from "../../actions/HTTP_STATUSES";

/**
 * Race to the Bottom — submission payload schemas. The FE wraps every
 * single-input submission in a generic `field: [{ text, label }]` envelope
 * (the same shape Dirty Laundry's `truths` uses, just with `field` as the
 * wrapper key). All three RTB submission schemas mirror that envelope; the
 * inner `text` is interpreted differently per action (free text, bid
 * integer, ack tap).
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
  (val) => val.field[0].text.trim().length > 0 && val.field[0].text.length <= 280,
  { message: "Challenge must be between 1 and 280 characters" },
);

export type HostPromptSubmission = z.infer<typeof hostPromptSubmissionSchema>;

export const bidSubmissionSchema = fieldEnvelope;

export type BidSubmission = z.infer<typeof bidSubmissionSchema>;

export const hostFinalizeSubmissionSchema = fieldEnvelope;

export type HostFinalizeSubmission = z.infer<typeof hostFinalizeSubmissionSchema>;

/**
 * HOST_CONFIRM_COMPLETION envelope. `field[0].text` must be either
 * `"confirmed"` (award points) or `"denied"` (no points). Enforced via
 * `refine` so the FE gets a clean 422 on any other value.
 */
export const hostConfirmCompletionSubmissionSchema = fieldEnvelope.refine(
  (val) =>
    val.field[0].text === "confirmed" || val.field[0].text === "denied",
  { message: "Completion must be 'confirmed' or 'denied'" },
);

export type HostConfirmCompletionSubmission = z.infer<
  typeof hostConfirmCompletionSubmissionSchema
>;

/**
 * Returns `true` if the host confirmed the winner completed the prompt,
 * `false` if denied. Throws the standard `{ status, error }` shape on
 * anything else.
 */
export const extractCompletionConfirmation = (payload: unknown): boolean => {
  const parsed = hostConfirmCompletionSubmissionSchema.parse(payload);
  return parsed.field[0].text === "confirmed";
};

/**
 * Same as `extractCompletionConfirmation` but returns `null` instead of
 * throwing — used by resolver handlers that read historical submissions.
 */
export const tryExtractCompletionConfirmation = (
  payload: unknown,
): boolean | null => {
  const parsed = hostConfirmCompletionSubmissionSchema.safeParse(payload);
  if (!parsed.success) return null;
  return parsed.data.field[0].text === "confirmed";
};

/**
 * Extract the host's challenge text from a HOST_PROMPT_SUBMIT payload.
 * Returns the trimmed string.
 */
export const extractChallengeText = (payload: unknown): string => {
  const parsed = hostPromptSubmissionSchema.parse(payload);
  return parsed.field[0].text.trim();
};

/**
 * Extract the bid amount from an AUCTION_BID payload. The FE sends the
 * number as a string in `field[0].text`; we validate it's a non-negative
 * integer in [0, 10000] and throw the standard `{ status, error }` shape
 * on failure so `submitRound` reports a clean 422 to the FE.
 */
export const extractBidAmount = (payload: unknown): number => {
  const parsed = bidSubmissionSchema.parse(payload);
  const raw = parsed.field[0].text.trim();
  if (!/^\d+$/.test(raw)) {
    throw {
      status: HTTP_STATUSES.CLIENT_ERROR.UNPROCESSABLE_CONTENT,
      error: ["Bid must be a non-negative integer"],
    };
  }
  const amount = Number.parseInt(raw, 10);
  if (amount < 0 || amount > 10_000) {
    throw {
      status: HTTP_STATUSES.CLIENT_ERROR.UNPROCESSABLE_CONTENT,
      error: ["Bid must be between 0 and 10000"],
    };
  }
  return amount;
};

/**
 * Same as `extractBidAmount` but returns `null` instead of throwing — used
 * by the resolver and tally handlers that scan historical submissions and
 * want to skip malformed rows rather than abort.
 */
export const tryExtractBidAmount = (payload: unknown): number | null => {
  const parsed = bidSubmissionSchema.safeParse(payload);
  if (!parsed.success) return null;
  const raw = parsed.data.field[0].text.trim();
  if (!/^\d+$/.test(raw)) return null;
  const amount = Number.parseInt(raw, 10);
  if (amount < 0 || amount > 10_000) return null;
  return amount;
};

/**
 * Pick the lowest bid across a list of AUCTION_BID submissions. Malformed
 * payloads are skipped. Tie on amount → earliest `createdAt` wins, matching
 * `runBidResolveAndScore`'s winner-selection rule.
 */
export const findLowestBid = (
  submissions: ReadonlyArray<{
    userId: string;
    payload: unknown;
    createdAt: Date;
  }>,
): { amount: number; userId: string } | null => {
  let low: { amount: number; userId: string; createdAt: Date } | null = null;
  for (const sub of submissions) {
    const value = tryExtractBidAmount(sub.payload);
    if (value === null) continue;
    if (
      low === null ||
      value < low.amount ||
      (value === low.amount && sub.createdAt < low.createdAt)
    ) {
      low = { amount: value, userId: sub.userId, createdAt: sub.createdAt };
    }
  }
  return low ? { amount: low.amount, userId: low.userId } : null;
};

export const raceToTheBottomSubmissionSchemas = {
  HOST_PROMPT_SUBMIT: hostPromptSubmissionSchema,
  AUCTION_BID: bidSubmissionSchema,
  HOST_FINALIZE: hostFinalizeSubmissionSchema,
  HOST_CONFIRM_COMPLETION: hostConfirmCompletionSubmissionSchema,
} as const;

export type RaceToTheBottomActionTypeName =
  keyof typeof raceToTheBottomSubmissionSchemas;
