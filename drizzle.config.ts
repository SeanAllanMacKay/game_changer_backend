import "dotenv/config";
import { defineConfig } from "drizzle-kit";
import path from "path";
import * as fs from "fs";

export default defineConfig({
  out: "./drizzle",
  schema: "./src/services/db/schemas/index.ts",
  dialect: "postgresql",
  dbCredentials: {
    host: process.env.DB_HOST!,
    port: Number(process.env.DB_PORT!),
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    database: process.env.DB_DATABASE!,
    ssl: {
      ca: process.env.DB_CA_CERT
        ? process.env.DB_CA_CERT
        : fs.readFileSync(path.resolve(__dirname, "./ca.pem")).toString(),
    },
  },
  verbose: true,
});
