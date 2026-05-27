import { eq, inArray } from "drizzle-orm";
import {
  db,
  Game,
  GameRound,
  GameRoundAction,
  GameRoundActionConfig,
} from "../../";
import type { ActionInput } from "../../inputSchema";

export type StartGameInDbProps = {
  gameCode: string;
  rounds: (typeof GameRound.$inferInsert)[];
};

export const startGameInDb = async ({
  gameCode,
  rounds,
}: StartGameInDbProps) => {
  return await db.transaction(async (tx) => {
    if (rounds.length > 0) {
      const insertedRounds = await tx
        .insert(GameRound)
        .values(rounds)
        .returning({
          id: GameRound.id,
          roundConfigId: GameRound.roundConfigId,
        });

      const roundConfigIds = [
        ...new Set(insertedRounds.map((r) => r.roundConfigId)),
      ];

      const actionConfigs = await tx
        .select({
          id: GameRoundActionConfig.id,
          roundConfigId: GameRoundActionConfig.roundConfigId,
          actionTypeId: GameRoundActionConfig.actionTypeId,
          inputSchema: GameRoundActionConfig.inputSchema,
        })
        .from(GameRoundActionConfig)
        .where(inArray(GameRoundActionConfig.roundConfigId, roundConfigIds));

      const actionConfigsByRoundConfigId = new Map<
        string,
        { id: string; actionTypeId: string; inputSchema: ActionInput | null }[]
      >();
      for (const ac of actionConfigs) {
        const list = actionConfigsByRoundConfigId.get(ac.roundConfigId) ?? [];
        list.push({
          id: ac.id,
          actionTypeId: ac.actionTypeId,
          inputSchema: ac.inputSchema,
        });
        actionConfigsByRoundConfigId.set(ac.roundConfigId, list);
      }

      const actionsToInsert: (typeof GameRoundAction.$inferInsert)[] = [];
      for (const round of insertedRounds) {
        const configs =
          actionConfigsByRoundConfigId.get(round.roundConfigId) ?? [];
        for (const { id: configId, actionTypeId, inputSchema } of configs) {
          actionsToInsert.push({
            configId,
            actionTypeId,
            roundId: round.id,
            inputSchema,
          });
        }
      }

      if (actionsToInsert.length > 0) {
        await tx.insert(GameRoundAction).values(actionsToInsert);
      }

      await tx
        .update(GameRound)
        .set({ status: "IN_PROGRESS" })
        .where(eq(GameRound.id, insertedRounds[0].id));
    }
    const [game] = await tx
      .update(Game)
      .set({ status: "IN_PROGRESS" })
      .where(eq(Game.gameCode, gameCode))
      .returning();
    return game;
  });
};
