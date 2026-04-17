import postgres from "postgres";

const DATABASE_URL = "postgresql://neondb_owner:npg_9pmJlr6etKHE@ep-little-math-ah9b7sm0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

async function main() {
  const sql = postgres(DATABASE_URL);
  const email = "macielsuassuna14@gmail.com";

  try {
    console.log(`>>> Conectando ao banco fornecido pelo usuário: ${DATABASE_URL.substring(0, 30)}...`);
    
    const user = await sql`SELECT id, name, email, role, active, email_verified FROM "user" WHERE email = ${email}`;
    
    if (user.length === 0) {
      console.log(`[!] Usuário ${email} NÃO ENCONTRADO neste banco.`);
    } else {
      console.log(`[+] Usuário ${email} ENCONTRADO!`);
      console.table(user);
      
      const accounts = await sql`SELECT id, provider_id, user_id FROM "account" WHERE user_id = ${user[0].id}`;
      console.log(">>> Contas associadas:");
      console.table(accounts);
    }

  } catch (error: any) {
    console.error(`[ERRO]:`, error.message || error);
  } finally {
    await sql.end();
  }
}

main();
