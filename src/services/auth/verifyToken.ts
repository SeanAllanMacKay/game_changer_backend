import auth from "./";

import { getUserById } from "../../actions";

import type { RequestHandler } from "express";

// @ts-ignore
const verifyToken: RequestHandler = async (req, res, next) => {
  const {
    signedCookies: { auth: token },
  } = req;

  if (token) {
    const verifiedToken = (await auth.verify(token)) as { id: string };

    if (verifiedToken) {
      const { user } = await getUserById({ id: verifiedToken.id });

      // @ts-ignore
      req.user = user;

      next();
    } else {
      return res.status(401).send({ error: "Unauthorized" });
    }
  } else {
    return res.status(401).send({ error: "Unauthorized" });
  }
};

export default verifyToken;
