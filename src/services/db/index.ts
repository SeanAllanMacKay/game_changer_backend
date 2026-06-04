import * as fs from "fs";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import path from "path";

import * as schema from "./schemas";
import * as relations from "./relations";

// In hosted environments (e.g. Railway) ca.pem is not on disk — the Aiven CA
// cert is supplied via the DB_CA_CERT env var instead. Locally we fall back to
// reading the gitignored ca.pem at the repo root.
const caCert = process.env.DB_CA_CERT
  ? process.env.DB_CA_CERT
  : fs.readFileSync(path.resolve(__dirname, "../../../ca.pem")).toString();

const client = new Pool({
  host: process.env.DB_HOST!,
  port: Number(process.env.DB_PORT!),
  user: process.env.DB_USER!,
  password: process.env.DB_PASSWORD!,
  database: process.env.DB_DATABASE!,
  ssl: {
    rejectUnauthorized: true,
    ca: caCert,
  },
});

export const db = drizzle(client, { schema: { ...schema, ...relations } });

export * from "./schemas";
export * from "./queries";
export * from "./inputSchema";
