import postgres from "postgres";

// URL B (found in scripts/tests/final_verify_aura.ts)
const DATABASE_URL_B = "postgresql://neondb_owner:npg_Mmy0tQl2CTKS@ep-steep-base-a4rcsq71-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

async function main() {
  const sql = postgres(DATABASE_URL_B);
  const email = "macielsuassuna14@gmail.com";

  try {
    console.log(`>>> Procurando por ${email} no banco de dados B...`);
    const users = await sql`SELECT id, name, email, role FROM "user" WHERE email = ${email}`;
    
    if (users.length > 0) {
      console.log("[ENCONTRADO NO BANCO B]");
      console.table(users);
    } else {
      console.log("[NÃO ENCONTRADO NO BANCO B]");
      
      console.log(">>> Listando usuários no banco B para conferência...");
      const allUsers = await sql`SELECT id, name, email, role FROM "user" LIMIT 10`;
      console.table(allUsers);
    }

  } catch (error: any) {
    console.error(`[ERRO BANCO B]:`, error.message || error);
  } finally {
    await sql.end();
  }
}

main();
