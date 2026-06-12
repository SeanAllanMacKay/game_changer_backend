import { Router } from "express";

import { HTTP_STATUSES, getUserById, login, signUp } from "../../actions";
import auth from "../../services/auth";
import requireDeviceId from "../../services/auth/requireDeviceId";
import { selectUserByDeviceId } from "../../services/db";

const router = Router({ mergeParams: true });

router.route("/").get(requireDeviceId, async (req: any, res) => {
  try {
    const {
      signedCookies: { auth: token },
      deviceId,
    } = req;

    let user: unknown;

    if (token) {
      const verifiedToken = (await auth.verify(token)) as
        | { id: string }
        | false;

      if (verifiedToken) {
        ({ user } = await getUserById({ id: verifiedToken.id }));
      }
    }

    // No (valid) auth token — fall back to the guest identified by deviceId.
    if (!user) {
      user = await selectUserByDeviceId({ deviceId });
    }

    if (user) {
      res
        .status(HTTP_STATUSES.SUCCESS.OK)
        .send({ message: "Account found", user });
    } else {
      throw {
        status: HTTP_STATUSES.CLIENT_ERROR.NOT_FOUND,
        error: "Account not found",
      };
    }
  } catch (caught: any) {
    const {
      status = HTTP_STATUSES.SERVER_ERROR.INTERNAL_SERVER_ERROR,
      error = "There was an error fetching this user",
    } = caught;

    res.status(status).send({ error });
  }
});

router.route("/login").post(requireDeviceId, async (req: any, res) => {
  try {
    const {
      body: { password, name },
      deviceId,
    } = req;

    const { status, user, newToken, message } = await login({
      password,
      name,
      deviceId,
    });

    if (user && newToken) {
      res.cookie("auth", newToken, {
        httpOnly: true,
        signed: true,
        sameSite: "none",
        secure: true,
        partitioned: true,
      });

      res.status(status).send({ user, message });
    } else {
      const { status, user, newToken, message } = await signUp({
        password,
        name,
        deviceId,
      });

      res.cookie("auth", newToken, {
        httpOnly: true,
        signed: true,
        sameSite: "none",
        secure: true,
        partitioned: true,
      });

      res.status(status).send({ user, message });
    }
  } catch (caught: any) {
    console.log(caught);
    const {
      status = HTTP_STATUSES.SERVER_ERROR.INTERNAL_SERVER_ERROR,
      error = "We weren't able to log you in",
    } = caught;

    res.clearCookie("auth");

    res.status(status).send({ error });
  }
});

router.route("/logout").post(async (_req, res) => {
  res.clearCookie("auth", {
    httpOnly: true,
    signed: true,
    sameSite: "none",
    secure: true,
    partitioned: true,
  });

  res.status(HTTP_STATUSES.SUCCESS.OK).send({ message: "Logged out" });
});

export default router;
