import { eq } from "drizzle-orm";
import { db, User } from "../..";

export const selectUserByDeviceId = async ({
  deviceId,
}: {
  deviceId: string;
}) => {
  return await db.query.User.findFirst({
    where: eq(User.deviceId, deviceId),
    columns: {
      id: true,
      name: true,
      createdAt: true,
    },
  });
};
