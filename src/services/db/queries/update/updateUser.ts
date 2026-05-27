import { eq } from "drizzle-orm";
import { db, User } from "../../";

export type UpdateUserProps = {
  userId: string;
  name?: string;
  password?: string;
};

export const updateUser = async ({
  userId,
  name,
  password,
}: UpdateUserProps) => {
  const [user] = await db
    .update(User)
    .set({
      ...(name !== undefined ? { name } : {}),
      ...(password !== undefined ? { password } : {}),
    })
    .where(eq(User.id, userId))
    .returning({
      id: User.id,
      createdAt: User.createdAt,
      name: User.name,
    });

  return user;
};
