DROP TABLE "GameRoundSubmissionVote" CASCADE;--> statement-breakpoint
ALTER TABLE "GameRoundSubmission" ADD COLUMN "payload" jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "GameRoundSubmission" DROP COLUMN "text";--> statement-breakpoint
ALTER TABLE "GameRoundSubmission" DROP COLUMN "mediaUrl";--> statement-breakpoint
ALTER TABLE "GameRoundSubmission" DROP COLUMN "mediaType";