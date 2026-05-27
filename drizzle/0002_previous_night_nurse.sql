ALTER TABLE "User" ADD COLUMN "deviceId" text;--> statement-breakpoint
ALTER TABLE "User" ADD CONSTRAINT "User_deviceId_unique" UNIQUE("deviceId");