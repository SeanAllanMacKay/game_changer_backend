import * as z from "zod";

import { HTTP_STATUSES } from "../../actions/HTTP_STATUSES";

/**
 * What a player submits for the Setup round's TEXT_SUBMISSION action.
 * Matches the field-list inputSchema seeded for this action: one entry per
 * defined truth field, each carrying the field's `label` and the player's
 * `text`.
 */
export const truthsSubmissionSchema = z.object({
  truths: z
    .array(
      z.object({
        label: z.string().min(1),
        text: z.string().min(1),
      }),
    )
    .min(1),
});

export type TruthsSubmission = z.infer<typeof truthsSubmissionSchema>;

/**
 * What a player submits for the Gameplay round's DELIBERATE_AND_VOTE action.
 * Matches the seeded `playerSelect` inputSchema: a single userId pick. The
 * cross-checks (voted-for must be in the game; voter can't pick themselves
 * because `allowSelf: false`) live in `validateVoteAgainstGame` since they
 * require game state that a pure zod schema can't see.
 */
export const voteSubmissionSchema = z.object({
  selectedPlayerIds: z.array(z.string().uuid()).length(1),
});

export type VoteSubmission = z.infer<typeof voteSubmissionSchema>;

export const validateVoteAgainstGame = (
  vote: VoteSubmission,
  ctx: { voterUserId: string; playerUserIds: string[] },
): void => {
  const players = new Set(ctx.playerUserIds);
  for (const votedForUserId of vote.selectedPlayerIds) {
    if (votedForUserId === ctx.voterUserId) {
      throw {
        status: HTTP_STATUSES.CLIENT_ERROR.UNPROCESSABLE_CONTENT,
        error: ["You cannot vote for yourself"],
      };
    }
    if (!players.has(votedForUserId)) {
      throw {
        status: HTTP_STATUSES.CLIENT_ERROR.UNPROCESSABLE_CONTENT,
        error: ["Voted user is not a player in this game"],
      };
    }
  }
};

