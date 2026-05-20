import postgres from "postgres";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

const url = process.env.DATABASE_URL;

if (!url) {
  console.error("DATABASE_URL not found in environment");
  process.exit(1);
}

const client = postgres(url, { max: 1 });

async function checkSchema() {
  try {
    console.log(">>> [CHECK-SCHEMA] Connecting to staging database...");
    
    const tables = await client`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `;
    
    console.log("\n>>> [CHECK-SCHEMA] Tables in staging database:");
    console.log("===========================================");
    tables.forEach((t, i) => {
      console.log(`${i + 1}. ${t.table_name}`);
    });
    console.log("===========================================");
    console.log(`Total: ${tables.length} tables\n`);
    
    const migrations = await client`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = '__drizzle_migrations'
      ) as has_migrations
    `;
    
    if (migrations[0].has_migrations) {
      console.log(">>> [CHECK-SCHEMA] ✓ Drizzle migrations table exists");
      const appliedMigrations = await client`
        SELECT name, applied_at 
        FROM __drizzle_migrations 
        ORDER BY id
      `;
      console.log(`>>> [CHECK-SCHEMA] Applied migrations: ${appliedMigrations.length}`);
      appliedMigrations.forEach((m, i) => {
        console.log(`  ${i + 1}. ${m.name}`);
      });
    } else {
      console.log(">>> [CHECK-SCHEMA] ✗ Drizzle migrations table does NOT exist");
    }
    
    await client.end();
    process.exit(0);
  } catch (error) {
    console.error(">>> [CHECK-SCHEMA] Error:", error);
    await client.end();
    process.exit(1);
  }
}

checkSchema();
