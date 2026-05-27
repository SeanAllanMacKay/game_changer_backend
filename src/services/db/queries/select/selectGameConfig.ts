import { db } from "../../";

export type SelectGameConfigProps = {
  gameConfigId: string;
};

export const selectGameConfig = async ({
  gameConfigId,
}: SelectGameConfigProps) => {
  return await db.query.GameConfig.findFirst({
    where: (gameConfig, { eq }) => eq(gameConfig.id, gameConfigId),
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
