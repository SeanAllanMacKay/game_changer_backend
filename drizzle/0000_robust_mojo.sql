CREATE TYPE "public"."GameStatus" AS ENUM('WAITING', 'IN_PROGRESS', 'PAUSED', 'COMPLETED', 'ABANDONED');--> statement-breakpoint
CREATE TYPE "public"."GameRoundStatus" AS ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED');--> statement-breakpoint
CREATE TYPE "public"."MediaType" AS ENUM('IMAGE', 'VIDEO', 'AUDIO');--> statement-breakpoint
CREATE TYPE "public"."GameRoundActionRole" AS ENUM('SYSTEM', 'HOST', 'PLAYER');--> statement-breakpoint
CREATE TABLE "User" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"password" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"deletedDate" timestamp,
	CONSTRAINT "User_id_unique" UNIQUE("id")
);
--> statement-breakpoint
CREATE TABLE "Game" (
	"gameCode" text PRIMARY KEY NOT NULL,
	"configId" uuid NOT NULL,
	"status" "GameStatus" DEFAULT 'WAITING' NOT NULL,
	"winnerId" uuid,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "Game_gameCode_unique" UNIQUE("gameCode")
);
--> statement-breakpoint
CREATE TABLE "GameConfig" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"maxPlayers" integer,
	"minPlayers" integer,
	CONSTRAINT "GameConfig_id_unique" UNIQUE("id")
);
--> statement-breakpoint
CREATE TABLE "RoundConfig" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gameConfigId" uuid NOT NULL,
	"order" integer NOT NULL,
	"repeatCount" integer DEFAULT 1 NOT NULL,
	"name" text,
	"description" text,
	CONSTRAINT "RoundConfig_id_unique" UNIQUE("id")
);
--> statement-breakpoint
CREATE TABLE "GameRound" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gameCode" text NOT NULL,
	"roundConfigId" uuid NOT NULL,
	"order" integer NOT NULL,
	"status" "GameRoundStatus" DEFAULT 'PENDING' NOT NULL,
	"activePlayerId" uuid,
	"promptText" text,
	"promptMediaUrl" text,
	"promptMediaType" "MediaType",
	"winnerId" uuid,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "GameRound_id_unique" UNIQUE("id")
);
--> statement-breakpoint
CREATE TABLE "GameRoundSubmission" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"roundId" uuid NOT NULL,
	"actionId" uuid NOT NULL,
	"text" text,
	"mediaUrl" text,
	"mediaType" "MediaType",
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "GameRoundSubmission_id_unique" UNIQUE("id"),
	CONSTRAINT "GameRoundSubmission_userId_actionId_unique" UNIQUE("userId","actionId")
);
--> statement-breakpoint
CREATE TABLE "GameRoundSubmissionVote" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"submissionId" uuid NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "GameRoundSubmissionVote_id_unique" UNIQUE("id"),
	CONSTRAINT "GameRoundSubmissionVote_userId_submissionId_unique" UNIQUE("userId","submissionId")
);
--> statement-breakpoint
CREATE TABLE "GameRoundActionType" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"role" "GameRoundActionRole" NOT NULL,
	CONSTRAINT "GameRoundActionType_id_unique" UNIQUE("id")
);
--> statement-breakpoint
CREATE TABLE "UserGame" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"gameCode" text NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "UserGame_id_unique" UNIQUE("id"),
	CONSTRAINT "UserGame_userId_gameCode_unique" UNIQUE("userId","gameCode")
);
--> statement-breakpoint
CREATE TABLE "GameRoundAction" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"configId" uuid NOT NULL,
	"roundId" uuid NOT NULL,
	"input" jsonb,
	"output" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "GameRoundAction_id_unique" UNIQUE("id")
);
--> statement-breakpoint
CREATE TABLE "GameRoundActionConfig" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actionTypeId" uuid NOT NULL,
	"roundConfigId" uuid NOT NULL,
	"order" integer NOT NULL,
	"timer" bigint,
	"description" text NOT NULL,
	"prompt" text,
	CONSTRAINT "GameRoundActionConfig_id_unique" UNIQUE("id")
);
--> statement-breakpoint
ALTER TABLE "Game" ADD CONSTRAINT "Game_configId_GameConfig_id_fk" FOREIGN KEY ("configId") REFERENCES "public"."GameConfig"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Game" ADD CONSTRAINT "Game_winnerId_User_id_fk" FOREIGN KEY ("winnerId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "RoundConfig" ADD CONSTRAINT "RoundConfig_gameConfigId_GameConfig_id_fk" FOREIGN KEY ("gameConfigId") REFERENCES "public"."GameConfig"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "GameRound" ADD CONSTRAINT "GameRound_gameCode_Game_gameCode_fk" FOREIGN KEY ("gameCode") REFERENCES "public"."Game"("gameCode") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "GameRound" ADD CONSTRAINT "GameRound_roundConfigId_RoundConfig_id_fk" FOREIGN KEY ("roundConfigId") REFERENCES "public"."RoundConfig"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "GameRound" ADD CONSTRAINT "GameRound_activePlayerId_User_id_fk" FOREIGN KEY ("activePlayerId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "GameRound" ADD CONSTRAINT "GameRound_winnerId_User_id_fk" FOREIGN KEY ("winnerId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "GameRoundSubmission" ADD CONSTRAINT "GameRoundSubmission_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "GameRoundSubmission" ADD CONSTRAINT "GameRoundSubmission_roundId_GameRound_id_fk" FOREIGN KEY ("roundId") REFERENCES "public"."GameRound"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "GameRoundSubmission" ADD CONSTRAINT "GameRoundSubmission_actionId_GameRoundAction_id_fk" FOREIGN KEY ("actionId") REFERENCES "public"."GameRoundAction"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "GameRoundSubmissionVote" ADD CONSTRAINT "GameRoundSubmissionVote_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "GameRoundSubmissionVote" ADD CONSTRAINT "GameRoundSubmissionVote_submissionId_GameRoundSubmission_id_fk" FOREIGN KEY ("submissionId") REFERENCES "public"."GameRoundSubmission"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "UserGame" ADD CONSTRAINT "UserGame_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "UserGame" ADD CONSTRAINT "UserGame_gameCode_Game_gameCode_fk" FOREIGN KEY ("gameCode") REFERENCES "public"."Game"("gameCode") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "GameRoundAction" ADD CONSTRAINT "GameRoundAction_configId_GameRoundActionConfig_id_fk" FOREIGN KEY ("configId") REFERENCES "public"."GameRoundActionConfig"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "GameRoundAction" ADD CONSTRAINT "GameRoundAction_roundId_GameRound_id_fk" FOREIGN KEY ("roundId") REFERENCES "public"."GameRound"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "GameRoundActionConfig" ADD CONSTRAINT "GameRoundActionConfig_actionTypeId_GameRoundActionType_id_fk" FOREIGN KEY ("actionTypeId") REFERENCES "public"."GameRoundActionType"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "GameRoundActionConfig" ADD CONSTRAINT "GameRoundActionConfig_roundConfigId_RoundConfig_id_fk" FOREIGN KEY ("roundConfigId") REFERENCES "public"."RoundConfig"("id") ON DELETE no action ON UPDATE no action;