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
    console.log(">>> Verificando colunas de 'prospects'...");
    const prospectCols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'prospects'`;
    console.table(prospectCols);

    console.log(">>> Verificando colunas de 'verification'...");
    const verifyCols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'verification'`;
    console.table(verifyCols);

    console.log(">>> Listando TODOS os e-mails na tabela 'user'...");
    const users = await sql`SELECT email FROM "user"`;
    console.table(users);

  } catch (error: any) {
    console.error(`[ERRO]:`, error.message || error);
  } finally {
    await sql.end();
  }
}

main();
