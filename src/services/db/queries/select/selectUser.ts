import { eq } from "drizzle-orm";
import { db, User } from "../..";

export const selectUser = async ({ userId }: { userId: string }) => {
  return await db.query.User.findFirst({
    where: eq(User.id, userId),
    columns: {
      id: true,
      name: true,
      createdAt: true,
    },
  });
};
