import * as fs from "fs";
import * as path from "path";
import { Pool } from "pg";

async function main() {
  const client = new Pool({
    host: process.env.DB_HOST!,
    port: Number(process.env.DB_PORT!),
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    database: process.env.DB_DATABASE!,
    ssl: {
      rejectUnauthorized: true,
      ca: fs.readFileSync(path.resolve(__dirname, "../ca.pem")).toString(),
    },
  });

  await client.query("DROP SCHEMA public CASCADE;");
  await client.query("CREATE SCHEMA public;");
  console.log("public schema dropped and recreated");
  await client.end();
}

main();
