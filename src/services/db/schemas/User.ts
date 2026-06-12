import { pgTable, uuid, text, timestamp, boolean } from "drizzle-orm/pg-core";

export const User = pgTable("User", {
  id: uuid().defaultRandom().unique().primaryKey(),
  name: text().notNull(),
  password: text().notNull(),
  deviceId: text().unique(),
  isGuest: boolean().notNull().default(false),

  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp()
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  deletedDate: timestamp(),
});
