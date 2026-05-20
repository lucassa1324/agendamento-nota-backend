import postgres from "postgres";
import * as dotenv from "dotenv";
import { readdir, readFile } from "fs/promises";
import { join } from "path";

dotenv.config({ path: ".env.local" });
dotenv.config();

const url = process.env.DATABASE_URL;

if (!url) {
  console.error("DATABASE_URL not found in environment");
  process.exit(1);
}

console.log(">>> [APPLY-SCHEMA] Applying schema to staging database");

const client = postgres(url, { max: 1 });

async function applySchema() {
  try {
    const drizzleDir = join(__dirname, "..", "..", "drizzle");
    const files = await readdir(drizzleDir);

    const sqlFiles = files
      .filter(f => f.endsWith(".sql"))
      .sort((a, b) => {
        const numA = parseInt(a.split("_")[0], 10);
        const numB = parseInt(b.split("_")[0], 10);
        return numA - numB;
      });

    console.log(">>> [APPLY-SCHEMA] Found", sqlFiles.length, "SQL files to apply");

    for (const file of sqlFiles) {
      const filePath = join(drizzleDir, file);
      const sql = await readFile(filePath, "utf-8");

      console.log(">>> [APPLY-SCHEMA] Applying", file, "(", sql.length, "bytes )");

      try {
        const migrationName = file.replace(".sql", "");

        const exists = await client`
            SELECT EXISTS (
              SELECT FROM information_schema.tables 
              WHERE table_schema = 'public' 
              AND table_name = '__drizzle_migrations'
            ) as has_migrations
          `;

        if (exists[0].has_migrations) {
          const alreadyApplied = await client`
              SELECT EXISTS (
                SELECT FROM __drizzle_migrations 
                WHERE name = ${migrationName}
              ) as applied
            `;

          if (alreadyApplied[0].applied) {
            console.log(">>> [APPLY-SCHEMA] ⊘", file, "already applied - skipping");
            continue;
          }
        }

        await client.unsafe(sql);
        console.log(">>> [APPLY-SCHEMA] ✓", file, "applied");

        await client.unsafe(`
            CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
              id SERIAL PRIMARY KEY,
              name VARCHAR(255) NOT NULL,
              applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
          `);

        await client`
            INSERT INTO "__drizzle_migrations" (name) 
            VALUES (${migrationName})
            ON CONFLICT DO NOTHING
          `;
      } catch (sqlError) {
        console.error(">>> [APPLY-SCHEMA] SQL Error in", file, ":", sqlError);
        if (sqlError instanceof Error) {
          console.error(">>> [APPLY-SCHEMA] Message:", sqlError.message);
          console.error(">>> [APPLY-SCHEMA] Stack:", sqlError.stack);
        }
        throw sqlError;
      }
    }

    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    for (const file of sqlFiles) {
      const migrationName = file.replace(".sql", "");
      await client`
        INSERT INTO "__drizzle_migrations" (name) 
        VALUES (${migrationName})
        ON CONFLICT DO NOTHING
      `;
    }

    console.log(">>> [APPLY-SCHEMA] ✓ Schema applied successfully!");
    console.log(">>> [APPLY-SCHEMA] All", sqlFiles.length, "migrations applied and tracked");

    await client.end();
    process.exit(0);
  } catch (error) {
    console.error(">>> [APPLY-SCHEMA] Failed to apply schema:", error);
    await client.end();
    process.exit(1);
  }
}

applySchema();
