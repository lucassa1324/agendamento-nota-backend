import postgres from "postgres";

const DATABASE_URL_B = "postgresql://neondb_owner:npg_Mmy0tQl2CTKS@ep-steep-base-a4rcsq71-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

async function main() {
  const sql = postgres(DATABASE_URL_B);
  const email = "macielsuassuna14@gmail.com";

  try {
    console.log(`>>> Coletando dados completos de ${email} no BANCO B...`);
    
    const user = await sql`SELECT * FROM "user" WHERE email = ${email}`;
    if (user.length === 0) {
      console.log("Usuário não encontrado no BANCO B.");
      return;
    }

    const account = await sql`SELECT * FROM "account" WHERE user_id = ${user[0].id}`;
    
    console.log("\n--- DADOS DO USUÁRIO ---");
    console.log(JSON.stringify(user[0], null, 2));
    
    console.log("\n--- DADOS DA CONTA ---");
    console.log(JSON.stringify(account[0], null, 2));

  } catch (error: any) {
    console.error(`[ERRO]:`, error.message || error);
  } finally {
    await sql.end();
  }
}

main();
