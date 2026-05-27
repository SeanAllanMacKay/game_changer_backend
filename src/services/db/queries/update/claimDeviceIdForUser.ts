import { and, eq, ne } from "drizzle-orm";
import { db, User } from "../../";

export const claimDeviceIdForUser = async ({
  userId,
  deviceId,
}: {
  userId: string;
  deviceId: string;
}) => {
  await db.transaction(async (tx) => {
    await tx
      .update(User)
      .set({ deviceId: null })
      .where(and(eq(User.deviceId, deviceId), ne(User.id, userId)));
    await tx
      .update(User)
      .set({ deviceId })
      .where(eq(User.id, userId));
  });
};
