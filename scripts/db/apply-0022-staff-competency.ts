import * as fs from "node:fs";
import * as path from "node:path";
import * as dotenv from "dotenv";
import postgres from "postgres";

dotenv.config({ path: ".env.local" });
dotenv.config();

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL não definido.");
}

const migrationPath = path.resolve(
  process.cwd(),
  "drizzle/0022_staff_services_competency.sql",
);
const migrationSql = fs.readFileSync(migrationPath, "utf8");

const sql = postgres(databaseUrl, {
  prepare: false,
  max: 1,
});

try {
  await sql.unsafe(migrationSql);
  console.log("Migration 0022 aplicada com sucesso.");
} finally {
  await sql.end();
}
