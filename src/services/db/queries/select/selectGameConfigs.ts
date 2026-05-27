import { db } from "../../";

export const selectGameConfigs = async () => {
  return await db.query.GameConfig.findMany({
    with: {
      roundConfigs: {
        with: {
          actionConfigs: {
            with: {
              actionType: true,
            },
          },
        },
      },
    },
  });
};
