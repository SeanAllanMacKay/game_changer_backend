CREATE TYPE "public"."RoundPhase" AS ENUM('SETUP', 'PLAY', 'RESULTS');--> statement-breakpoint
ALTER TABLE "RoundConfig" ADD COLUMN "phase" "RoundPhase" DEFAULT 'PLAY' NOT NULL;