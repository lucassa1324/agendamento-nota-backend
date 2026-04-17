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
    console.log(`>>> Listando últimos 20 usuários do banco de produção...`);
    const users = await sql`
      SELECT id, name, email, role FROM "user" ORDER BY created_at DESC LIMIT 20
    `;

    console.table(users);
  } catch (error: any) {
    console.error(`[ERRO] Falha ao listar usuários:`, error.message || error);
  } finally {
    await sql.end();
  }
}

main();
