import * as z from "zod";
import bcrypt from "bcryptjs";
import crypto from "crypto";

import {
  insertUser,
  insertUserGame,
  selectGame,
  selectGameByCode,
  selectUser,
  selectUserByDeviceId,
  selectUserGame,
  updateUser,
} from "../../services/db";
import auth from "../../services/auth";
import { GAME_EVENTS, gameChannel, realtime } from "../../services/realtime";
import { HTTP_STATUSES } from "../HTTP_STATUSES";

const JoinGameSchema = z.object({
  gameCode: z.string().min(1),
  name: z.string().min(1).optional(),
  deviceId: z.string().min(1),
});

type JoinGameProps = {
  gameCode: string;
  userId?: string;
  name?: string;
  deviceId: string;
};

export const joinGame = async ({
  gameCode,
  userId,
  name,
  deviceId,
}: JoinGameProps) => {
  try {
    JoinGameSchema.parse({ gameCode, name, deviceId });

    const normalizedGameCode = gameCode.toUpperCase();

    const existingGame = await selectGameByCode({
      gameCode: normalizedGameCode,
    });

    if (!existingGame) {
      throw {
        status: HTTP_STATUSES.CLIENT_ERROR.NOT_FOUND,
        error: ["Game not found"],
      };
    }

    let resolvedUserId: string | undefined = userId;
    let user: Awaited<ReturnType<typeof insertUser>> | undefined;
    let newToken: string | undefined;

    if (!resolvedUserId) {
      if (!name) {
        throw {
          status: HTTP_STATUSES.CLIENT_ERROR.BAD_REQUEST,
          error: ["A name is required to join as a guest"],
        };
      }

      const existingGuest = await selectUserByDeviceId({ deviceId });

      if (existingGuest) {
        user = await updateUser({ userId: existingGuest.id, name });
        resolvedUserId = existingGuest.id;
      } else {
        const guestPassword = bcrypt.hashSync(
          crypto.randomBytes(16).toString("hex"),
          8,
        );
        user = await insertUser({
          name,
          password: guestPassword,
          deviceId,
        });
        resolvedUserId = user.id;
      }

      newToken = auth.sign({ id: resolvedUserId });
    }

    const existingMembership = await selectUserGame({
      userId: resolvedUserId,
      gameCode: normalizedGameCode,
    });

    if (!existingMembership && existingGame.status !== "WAITING") {
      throw {
        status: HTTP_STATUSES.CLIENT_ERROR.CONFLICT,
        error: ["This game is no longer accepting new players"],
      };
    }

    const userGame = await insertUserGame({
      userId: resolvedUserId,
      gameCode: normalizedGameCode,
    });

    const game = await selectGame({
      userId: resolvedUserId,
      gameCode: normalizedGameCode,
    });

    if (userGame) {
      const broadcastUser =
        user ?? (await selectUser({ userId: resolvedUserId }));

      realtime.publish(
        gameChannel(normalizedGameCode),
        GAME_EVENTS.PLAYER_JOINED,
        {
          gameCode: normalizedGameCode,
          userGame,
          user: broadcastUser,
        },
      );
    }

    return {
      status: HTTP_STATUSES.SUCCESS.OK,
      message: "Joined game",
      game,
      user,
      newToken,
    };
  } catch (caught: any) {
    if (caught instanceof z.ZodError) {
      throw {
        status: HTTP_STATUSES.CLIENT_ERROR.BAD_REQUEST,
        error: caught.issues.map(({ message }) => message),
      };
    }

    const {
      status = HTTP_STATUSES.SERVER_ERROR.INTERNAL_SERVER_ERROR,
      error = ["There was an error joining this game"],
    } = caught;

    throw { status, error };
  }
};
