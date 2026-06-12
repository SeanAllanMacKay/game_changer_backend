import { eq } from "drizzle-orm";
import { db, User } from "../../";

export type UpdateUserProps = {
  userId: string;
  name?: string;
  password?: string;
  deviceId?: string | null;
  isGuest?: boolean;
};

export const updateUser = async ({
  userId,
  name,
  password,
  deviceId,
  isGuest,
}: UpdateUserProps) => {
  const [user] = await db
    .update(User)
    .set({
      ...(name !== undefined ? { name } : {}),
      ...(password !== undefined ? { password } : {}),
      ...(deviceId !== undefined ? { deviceId } : {}),
      ...(isGuest !== undefined ? { isGuest } : {}),
    })
    .where(eq(User.id, userId))
    .returning({
      id: User.id,
      createdAt: User.createdAt,
      name: User.name,
    });

  return user;
};
