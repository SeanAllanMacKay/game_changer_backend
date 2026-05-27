import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

export const User = pgTable("User", {
  id: uuid().defaultRandom().unique().primaryKey(),
  name: text().notNull(),
  password: text().notNull(),
  deviceId: text().unique(),

  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp()
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  deletedDate: timestamp(),
});
