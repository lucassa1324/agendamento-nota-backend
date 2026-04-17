import postgres from "postgres";
import dotenv from "dotenv";

dotenv.config({ path: ".env.production" });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL não definida em .env.production");
}

async function main() {
  const sql = postgres(connectionString!);
  const email = "macielsuassuna14@gmail.com";

  try {
    console.log(`>>> Procurando em 'account' e 'user' por ${email}...`);
    
    const userResult = await sql`SELECT * FROM "user" WHERE email = ${email}`;
    console.log("[USER TABLE]:", userResult.length > 0 ? "Encontrado" : "Não encontrado");
    if (userResult.length > 0) console.table(userResult);

    const accountResult = await sql`SELECT * FROM "account" WHERE account_id = ${email} OR id = ${email}`;
    console.log("[ACCOUNT TABLE]:", accountResult.length > 0 ? "Encontrado" : "Não encontrado");
    if (accountResult.length > 0) console.table(accountResult);

    // Procurar por qualquer campo que possa conter o email
    const anyUser = await sql`SELECT id, email, name FROM "user" WHERE email ILIKE '%maciel%'`;
    console.log("[ANY USER LIKE 'maciel']:", anyUser.length > 0 ? "Encontrado" : "Não encontrado");
    if (anyUser.length > 0) console.table(anyUser);

  } catch (error: any) {
    console.error(`[ERRO]:`, error.message || error);
  } finally {
    await sql.end();
  }
}

main();
