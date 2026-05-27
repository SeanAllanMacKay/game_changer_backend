import cookieParser from "cookie-parser";

import auth from "../auth";
import { getUserById } from "../../actions";

import type { Socket } from "socket.io";

const COOKIE_SECRET = process.env.COOKIE_SECRET ?? "";

function parseCookieHeader(header: string | undefined): Record<string, string> {
  if (!header) return {};

  return header.split(/;\s*/).reduce<Record<string, string>>((acc, pair) => {
    const eq = pair.indexOf("=");
    if (eq === -1) return acc;

    const key = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();

    try {
      acc[decodeURIComponent(key)] = decodeURIComponent(value);
    } catch {
      acc[key] = value;
    }

    return acc;
  }, {});
}

export interface AuthedSocketData {
  userId: string;
  user: unknown;
  deviceId: string;
}

export async function authenticateSocket(
  socket: Socket,
): Promise<AuthedSocketData | null> {
  const rawDeviceId = socket.handshake.auth?.deviceId;
  const deviceId =
    typeof rawDeviceId === "string" ? rawDeviceId.trim() : "";
  if (!deviceId) return null;

  const cookies = parseCookieHeader(socket.handshake.headers.cookie);
  const raw = cookies.auth;
  if (!raw) return null;

  const unsigned = cookieParser.signedCookie(raw, COOKIE_SECRET);
  if (!unsigned || unsigned === raw) return null;

  const verified = auth.verify(unsigned) as { id: string } | false;
  if (!verified) return null;

  try {
    const { user } = await getUserById({ id: verified.id });
    if (!user) return null;
    return { userId: verified.id, user, deviceId };
  } catch {
    return null;
  }
}
