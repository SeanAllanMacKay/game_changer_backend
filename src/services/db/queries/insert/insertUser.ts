import { db, User } from "../../";

export type InsertUserProps = Omit<typeof User.$inferInsert, "id">;

export const insertUser = async ({
  name,
  password,
  deviceId,
  isGuest,
}: InsertUserProps) => {
  const [user] = await db
    .insert(User)
    .values({
      name,
      password,
      deviceId,
      ...(isGuest !== undefined ? { isGuest } : {}),
    })
    .returning({
      id: User.id,
      createdAt: User.createdAt,
      name: User.name,
    });

  return user;
};
