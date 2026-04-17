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
    console.log(`>>> Buscando usuário: ${email} no banco de produção...`);
    const users = await sql`
      SELECT id, name, email, role FROM "user" WHERE email = ${email}
    `;

    if (users.length === 0) {
      console.error(`[ERRO] Usuário ${email} não encontrado.`);
      return;
    }

    const user = users[0];
    console.log(`[USER] Usuário encontrado: ${user.name} (${user.email}) - Role atual: ${user.role}`);

    console.log(`>>> Atualizando para SUPER_ADMIN...`);
    await sql`
      UPDATE "user" SET role = 'SUPER_ADMIN', updated_at = NOW() WHERE email = ${email}
    `;

    console.log(`[SUCESSO] Usuário ${email} agora é SUPER_ADMIN.`);
  } catch (error: any) {
    console.error(`[ERRO] Falha ao atualizar usuário:`, error.message || error);
  } finally {
    await sql.end();
  }
}

main();
