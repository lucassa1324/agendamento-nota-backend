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
    console.log(">>> Listando TODOS os usuários...");
    const users = await sql`SELECT id, name, email, role FROM "user"`;
    console.table(users);

    console.log(">>> Listando TODAS as contas (account)...");
    const accounts = await sql`SELECT id, user_id, provider_id, account_id FROM "account"`;
    console.table(accounts);

  } catch (error: any) {
    console.error(`[ERRO]:`, error.message || error);
  } finally {
    await sql.end();
  }
}

main();
