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
    console.log(`>>> Procurando usuários relacionados a 'maciel' ou 'suassuna' no banco de produção...`);
    const users = await sql`
      SELECT id, name, email, role FROM "user" 
      WHERE email ILIKE '%maciel%' OR email ILIKE '%suassuna%' OR name ILIKE '%maciel%' OR name ILIKE '%suassuna%'
    `;

    if (users.length === 0) {
      console.log(`[AVISO] Nenhum usuário encontrado com 'maciel' ou 'suassuna'.`);
      
      console.log(`>>> Listando TODOS os usuários para conferência manual...`);
      const allUsers = await sql`SELECT id, name, email, role FROM "user"`;
      console.table(allUsers);
    } else {
      console.table(users);
    }
  } catch (error: any) {
    console.error(`[ERRO] Falha ao procurar usuários:`, error.message || error);
  } finally {
    await sql.end();
  }
}

main();
