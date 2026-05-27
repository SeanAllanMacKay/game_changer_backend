import * as fs from "fs";
import * as path from "path";
import { Pool } from "pg";

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("usage: run-migration.ts <path-to-sql>");
    process.exit(2);
  }

  const sql = fs.readFileSync(file, "utf8");
  const statements = sql
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);

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

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const preview = stmt.replace(/\s+/g, " ").slice(0, 120);
    try {
      await client.query(stmt);
      console.log(`[${i + 1}/${statements.length}] OK   ${preview}`);
    } catch (err: any) {
      console.error(`[${i + 1}/${statements.length}] FAIL ${preview}`);
      console.error(`  -> ${err.message}`);
      console.error(`  -> code: ${err.code}, detail: ${err.detail ?? "n/a"}`);
      process.exit(1);
    }
  }
  await client.end();
}

main();
