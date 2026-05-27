CREATE TABLE "GameWinner" (
	"gameCode" text NOT NULL,
	"userId" uuid NOT NULL,
	CONSTRAINT "GameWinner_gameCode_userId_pk" PRIMARY KEY("gameCode","userId")
);
--> statement-breakpoint
ALTER TABLE "Game" DROP CONSTRAINT "Game_winnerId_User_id_fk";
--> statement-breakpoint
ALTER TABLE "GameWinner" ADD CONSTRAINT "GameWinner_gameCode_Game_gameCode_fk" FOREIGN KEY ("gameCode") REFERENCES "public"."Game"("gameCode") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "GameWinner" ADD CONSTRAINT "GameWinner_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Game" DROP COLUMN "winnerId";