import fs from "fs";
import postgres from "postgres";

type Col = { table_name: string; column_name: string; data_type: string; is_nullable: string };

function readUrls() {
  const txt = fs.readFileSync("scripts/backup.env/backup.env", "utf8");
  const staging = txt.match(/url stagin DATABASE_URL="([^"]+)"/)?.[1];
  const local = txt.match(/DATABASE_URL="(postgres:\/\/postgres:admin123@localhost:5432\/postgres)"/)?.[1];
  if (!staging || !local) throw new Error("URLs nao encontradas");
  return { staging, local };
}

async function getSchema(url: string) {
  const sql = postgres(url, { max: 1 });
  try {
    const tables = await sql`
      select table_name
      from information_schema.tables
      where table_schema='public' and table_type='BASE TABLE'
      order by table_name
    `;

    const columns = await sql`
      select table_name, column_name, data_type, is_nullable
      from information_schema.columns
      where table_schema='public'
      order by table_name, ordinal_position
    ` as Col[];

    return {
      tableSet: new Set(tables.map((t: any) => t.table_name as string)),
      columns,
    };
  } finally {
    await sql.end();
  }
}

const { local, staging } = readUrls();
const [l, s] = await Promise.all([getSchema(local), getSchema(staging)]);

const missingTables = [...l.tableSet].filter((t) => !s.tableSet.has(t));
const extraTables = [...s.tableSet].filter((t) => !l.tableSet.has(t));

const lCols = new Map(l.columns.map((c) => [`${c.table_name}.${c.column_name}`, c]));
const sCols = new Map(s.columns.map((c) => [`${c.table_name}.${c.column_name}`, c]));

const missingCols = [...lCols.keys()].filter((k) => !sCols.has(k));
const typeDiffs = [...lCols.keys()].filter((k) => {
  if (!sCols.has(k)) return false;
  const a = lCols.get(k)!;
  const b = sCols.get(k)!;
  return a.data_type !== b.data_type || a.is_nullable !== b.is_nullable;
});

console.log("MISSING_TABLES_IN_STAGING:", JSON.stringify(missingTables, null, 2));
console.log("EXTRA_TABLES_IN_STAGING:", JSON.stringify(extraTables, null, 2));
console.log("MISSING_COLUMNS_IN_STAGING:", JSON.stringify(missingCols, null, 2));
console.log("TYPE_OR_NULLABLE_DIFFS:", JSON.stringify(typeDiffs.map((k) => ({ key: k, local: lCols.get(k), staging: sCols.get(k) })), null, 2));
