import bcrypt from "bcryptjs";
import auth from "../../services/auth";
import { HTTP_STATUSES } from "../HTTP_STATUSES";
import * as z from "zod";
import { selectUserByName } from "../../services/db";

const LoginSchema = z.object({
  name: z.string("Invalid name"),
  password: z.string("Invalid password"),
  deviceId: z.string().min(1).optional(),
});

type LoginProps = {
  name: string;
  password: string;
  deviceId?: string;
};

export const login = async ({ name, password, deviceId }: LoginProps) => {
  try {
    LoginSchema.parse({ name, password, deviceId });

    const user = await selectUserByName({ name });

    if (!user) {
      return { status: HTTP_STATUSES.CLIENT_ERROR.NOT_FOUND, user: undefined };
    }

    const { id, password: dbPassword, ...restUser } = user;

    if (!bcrypt.compareSync(password, dbPassword)) {
      throw {
        status: HTTP_STATUSES.CLIENT_ERROR.UNAUTHORIZED,
        error: ["That name/password combination didn't match our records"],
      };
    }

    const newToken = auth.sign({ id });

    return {
      status: HTTP_STATUSES.SUCCESS.OK,
      user: { id, ...restUser },
      newToken,
      message: "Logged in",
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
      error = ["We weren't able to log you in"],
    } = caught;

    throw { status: status, error: error };
  }
};
