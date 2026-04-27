import fs from "fs";
import postgres from "postgres";

function readStagingDbUrl() {
  const backupEnv = fs.readFileSync("scripts/backup.env/backup.env", "utf8");
  const match = backupEnv.match(/url stagin DATABASE_URL="([^"]+)"/);
  if (!match?.[1]) throw new Error("DATABASE_URL de staging nao encontrada");
  return match[1];
}

const sql = postgres(readStagingDbUrl(), { max: 1 });

try {
  const [exists] = await sql`
    select exists (
      select 1
      from information_schema.tables
      where table_schema = 'public' and table_name = '__drizzle_migrations'
    ) as has_table
  `;

  console.log("HAS___DRIZZLE_MIGRATIONS:", exists?.has_table ?? false);

  if (exists?.has_table) {
    const rows = await sql`select * from __drizzle_migrations order by created_at asc`;
    console.log("MIGRATIONS_ROWS:", JSON.stringify(rows, null, 2));
  } else {
    console.log("MIGRATIONS_ROWS: []");
  }
} finally {
  await sql.end();
}
