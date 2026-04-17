import postgres from "postgres";
import dotenv from "dotenv";

dotenv.config({ path: ".env.production" });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL não definida em .env.production");
}

async function main() {
  const sql = postgres(connectionString!);

  try {
    console.log(">>> Listando esquemas no banco de dados...");
    const schemas = await sql`SELECT schema_name FROM information_schema.schemata`;
    console.table(schemas);

    console.log(">>> Listando tabelas em todos os esquemas (exceto pg_ e information_schema)...");
    const tables = await sql`
      SELECT table_schema, table_name 
      FROM information_schema.tables 
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
    `;
    console.table(tables);

  } catch (error: any) {
    console.error(`[ERRO]:`, error.message || error);
  } finally {
    await sql.end();
  }
}

main();
