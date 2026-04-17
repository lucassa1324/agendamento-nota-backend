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
    console.log(`>>> Pesquisa profunda por: ${email}`);

    // 1. Verificar prospects
    const prospects = await sql`SELECT * FROM "prospects" WHERE email = ${email}`;
    console.log(`[PROSPECTS]: ${prospects.length} registros`);
    if (prospects.length > 0) console.table(prospects);

    // 2. Verificar verification
    const verification = await sql`SELECT * FROM "verification" WHERE identifier = ${email}`;
    console.log(`[VERIFICATION]: ${verification.length} registros`);
    if (verification.length > 0) console.table(verification);

    // 3. Verificar se existe algum outro usuário com nome parecido
    const usersByName = await sql`SELECT id, name, email, role FROM "user" WHERE name ILIKE '%Maciel%' OR name ILIKE '%Suassuna%'`;
    console.log(`[USERS BY NAME]: ${usersByName.length} registros`);
    if (usersByName.length > 0) console.table(usersByName);

    // 4. Listar TODOS os e-mails da tabela user para garantir que não há erro de digitação
    const allEmails = await sql`SELECT email FROM "user"`;
    console.log(">>> Todos os e-mails na tabela 'user':");
    console.log(allEmails.map(u => u.email).join(", "));

  } catch (error: any) {
    console.error(`[ERRO]:`, error.message || error);
  } finally {
    await sql.end();
  }
}

main();
