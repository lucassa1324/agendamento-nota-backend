import postgres from "postgres";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

const url = process.env.DATABASE_URL;

if (!url) {
  console.error("DATABASE_URL not found in environment");
  process.exit(1);
}

console.log(">>> [CHECK-MIGRATIONS] Checking migration status for staging database");

const client = postgres(url, { max: 1 });

async function checkMigrationsStatus() {
  try {
    console.log(">>> [CHECK-MIGRATIONS] Querying __drizzle_migrations table...");

    const result = await client`
      SELECT id, name, applied_at 
      FROM "__drizzle_migrations" 
      ORDER BY id DESC
    `;

    if (result.length === 0) {
      console.log(">>> [CHECK-MIGRATIONS] No migrations found in the database!");
    } else {
      console.log(`>>> [CHECK-MIGRATIONS] Found ${result.length} applied migrations:`);
      result.forEach((row: any) => {
        console.log(`  - [${row.id}] ${row.name} (applied at: ${row.applied_at})`);
      });
    }

    console.log("\n>>> [CHECK-MIGRATIONS] Querying all tables in the database...");
    const tables = await client`
      SELECT table_name, table_schema 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `;

    console.log(`>>> [CHECK-MIGRATIONS] Found ${tables.length} tables in public schema:`);
    tables.forEach((table: any) => {
      console.log(`  - ${table.table_name}`);
    });

    await client.end();
    process.exit(0);
  } catch (error) {
    console.error(">>> [CHECK-MIGRATIONS] Failed to check migrations:", error);
    await client.end();
    process.exit(1);
  }
}

checkMigrationsStatus();
