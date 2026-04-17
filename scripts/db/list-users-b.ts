import postgres from "postgres";

const DATABASE_URL_B = "postgresql://neondb_owner:npg_Mmy0tQl2CTKS@ep-steep-base-a4rcsq71-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

async function main() {
  const sql = postgres(DATABASE_URL_B);

  try {
    console.log(">>> Listando usuários no BANCO B...");
    const users = await sql`SELECT id, name, email, role FROM "user"`;
    console.table(users);

  } catch (error: any) {
    console.error(`[ERRO]:`, error.message || error);
  } finally {
    await sql.end();
  }
}

main();
