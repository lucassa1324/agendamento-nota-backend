import fs from "fs";
import postgres from "postgres";

function readUrls() {
  const txt = fs.readFileSync("scripts/backup.env/backup.env", "utf8");
  const staging = txt.match(/url stagin DATABASE_URL="([^"]+)"/)?.[1];
  const local = txt.match(/DATABASE_URL="(postgres:\/\/postgres:admin123@localhost:5432\/postgres)"/)?.[1];
  if (!staging) throw new Error("staging url nao encontrada");
  if (!local) throw new Error("local url nao encontrada");
  return { staging, local };
}

const TABLES = [
  "appointments",
  "staff",
  "staff_services",
  "staff_services_competency",
  "system_settings",
  "master_templates",
  "__drizzle_migrations",
];

async function inspect(url: string, label: string) {
  const sql = postgres(url, { max: 1 });
  try {
    const tables = await sql`
      select table_name
      from information_schema.tables
      where table_schema='public'
      order by table_name
    `;

    const set = new Set(tables.map((t: any) => t.table_name));
    console.log(`\n[${label}]`);
    for (const t of TABLES) {
      console.log(`${t}: ${set.has(t)}`);
    }

    if (set.has("__drizzle_migrations")) {
      const rows = await sql`select * from __drizzle_migrations order by created_at asc`;
      console.log(`__drizzle_migrations rows: ${rows.length}`);
      console.log(JSON.stringify(rows.slice(-5), null, 2));
    }

    if (set.has("appointments")) {
      const cols = await sql`
        select column_name
        from information_schema.columns
        where table_schema='public' and table_name='appointments'
        order by ordinal_position
      `;
      console.log(`appointments cols: ${cols.map((c: any) => c.column_name).join(", ")}`);
    }
  } finally {
    await sql.end();
  }
}

const { staging, local } = readUrls();
await inspect(local, "LOCAL");
await inspect(staging, "STAGING");
