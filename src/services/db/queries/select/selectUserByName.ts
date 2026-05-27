import { eq } from "drizzle-orm";
import { db, User } from "../..";

export const selectUserByName = async ({ name }: { name: string }) => {
  return await db.query.User.findFirst({
    where: eq(User.name, name),
    columns: {
      id: true,
      name: true,
      createdAt: true,
      password: true,
    },
  });
};
