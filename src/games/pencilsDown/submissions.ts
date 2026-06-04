import * as z from "zod";

/**
 * Pencils Down — submission payload schemas.
 *
 * All three player/host actions use Make Some Noise's single-field envelope
 * (`{ field: [{ label, text }] }`) so the FE can reuse generic input
 * rendering. The `text` content differs per action:
 *
 *  - HOST_PROMPT_SUBMIT  → free text, 1..280 chars (same as MSN).
 *  - DRAWING_SUBMISSION  → JSON-encoded stroke array, capped at 256 KB
 *                          serialised. The internal stroke shape is whatever
 *                          the FE canvas produces; we only assert it's a
 *                          non-empty JSON array so a broken submission can't
 *                          crash the renderer.
 *  - HOST_SELECT_WINNER  → a slotId (e.g. "A", "B", ...) matching one of the
 *                          slots produced by `SHUFFLE_DRAWINGS`. The cross-
 *                          state check that the slot actually exists lives in
 *                          `validators.ts`.
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
 * Cap on the JSON-encoded stroke string. 256 KB is generous for a 3-minute
 * party-game doodle; if drawings ever bump up against this we'd move the
 * payload to object storage and store a URL on `GameRound.promptMediaUrl`.
 */
export const MAX_DRAWING_PAYLOAD_BYTES = 256 * 1024;

export const drawingSubmissionSchema = fieldEnvelope.superRefine((val, ctx) => {
  const text = val.field[0].text;
  if (text.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Drawing cannot be empty",
    });
    return;
  }
  if (text.length > MAX_DRAWING_PAYLOAD_BYTES) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Drawing exceeds ${MAX_DRAWING_PAYLOAD_BYTES} bytes`,
    });
    return;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Drawing must be valid JSON",
    });
    return;
  }
  if (!Array.isArray(parsed)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Drawing must be a JSON array of strokes",
    });
    return;
  }
  if (parsed.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Drawing must contain at least one stroke",
    });
  }
});

export type DrawingSubmission = z.infer<typeof drawingSubmissionSchema>;

/**
 * Returns the raw stroke-array JSON string. We don't decode it on the BE —
 * the FE owns the stroke schema. The seed describes the contract in
 * `inputSchema: { kind: "drawing", ... }`.
 */
export const extractDrawingText = (payload: unknown): string => {
  const parsed = drawingSubmissionSchema.parse(payload);
  return parsed.field[0].text;
};

const SLOT_ID_PATTERN = /^[A-Z]{1,2}$/;

export const hostSelectWinnerSubmissionSchema = fieldEnvelope.refine(
  (val) => SLOT_ID_PATTERN.test(val.field[0].text.trim()),
  { message: "Winner selection must be a slot id (e.g. 'A', 'B', ...)" },
);

export type HostSelectWinnerSubmission = z.infer<
  typeof hostSelectWinnerSubmissionSchema
>;

export const extractWinningSlotId = (payload: unknown): string => {
  const parsed = hostSelectWinnerSubmissionSchema.parse(payload);
  return parsed.field[0].text.trim();
};

export const pencilsDownSubmissionSchemas = {
  HOST_PROMPT_SUBMIT: hostPromptSubmissionSchema,
  DRAWING_SUBMISSION: drawingSubmissionSchema,
  HOST_SELECT_WINNER: hostSelectWinnerSubmissionSchema,
} as const;

export type PencilsDownActionTypeName =
  keyof typeof pencilsDownSubmissionSchemas;
