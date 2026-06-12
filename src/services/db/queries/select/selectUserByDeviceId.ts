import { and, eq } from "drizzle-orm";
import { db, User } from "../..";

export const selectUserByDeviceId = async ({
  deviceId,
}: {
  deviceId: string;
}) => {
  return await db.query.User.findFirst({
    where: and(eq(User.deviceId, deviceId), eq(User.isGuest, true)),
    columns: {
      id: true,
      name: true,
      createdAt: true,
    },
  });
};
