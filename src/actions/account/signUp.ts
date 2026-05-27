import bcrypt from "bcryptjs";
import { HTTP_STATUSES } from "../";
import * as z from "zod";

import {
  selectUserByName,
  selectUserByDeviceId,
  insertUser,
  updateUser,
  InsertUserProps,
} from "../../services/db";
import auth from "../../services/auth";

type SignUpProps = InsertUserProps;

const successMessage = "Verification email sent!";

const SignUpSchema = z.object({
  name: z.string(),
  password: z.string().min(8),
  deviceId: z.string().min(1).optional(),
});

export const signUp = async ({
  name,
  password,
  deviceId,
  ...rest
}: SignUpProps) => {
  try {
    SignUpSchema.parse({ name, password, deviceId, ...rest });

    const existingGuest = deviceId
      ? await selectUserByDeviceId({ deviceId })
      : undefined;
    const existingAccount = await selectUserByName({ name });

    if (existingAccount && existingAccount.id !== existingGuest?.id) {
      return { status: HTTP_STATUSES.CLIENT_ERROR.CONFLICT, message: "" };
    }

    const hashedPassword = bcrypt.hashSync(password, 8);

    if (existingGuest) {
      const updatedUser = await updateUser({
        userId: existingGuest.id,
        name,
        password: hashedPassword,
      });

      const newToken = auth.sign({ id: updatedUser.id });

      return {
        status: HTTP_STATUSES.SUCCESS.OK,
        message: successMessage,
        user: updatedUser,
        newToken,
      };
    }

    const newUser = await insertUser({
      ...rest,
      name,
      password: hashedPassword,
      deviceId,
    });

    const newToken = auth.sign({ id: newUser.id });

    return {
      status: HTTP_STATUSES.SUCCESS.CREATED,
      message: successMessage,
      user: newUser,
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
      error = ["There was an error creating this account"],
    } = caught;

    throw {
      status: status,
      error: error,
    };
  }
};
