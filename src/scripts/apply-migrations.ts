import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

const url = process.env.DATABASE_URL;

if (!url) {
  console.error("DATABASE_URL not found in environment");
  process.exit(1);
}

console.log(">>> [MIGRATIONS] Starting migration for staging database");

const client = postgres(url, { max: 1 });
const db = drizzle(client);

async function runMigrations() {
  try {
    console.log(">>> [MIGRATIONS] Applying migrations...");
    await migrate(db, { migrationsFolder: "./drizzle" });
    console.log(">>> [MIGRATIONS] Migrations completed successfully!");
    await client.end();
    process.exit(0);
  } catch (error) {
    console.error(">>> [MIGRATIONS] Migration failed:", error);
    await client.end();
    process.exit(1);
  }
}

runMigrations();
