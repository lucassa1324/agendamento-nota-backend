import postgres from "postgres";

const localUrl = "postgres://postgres:admin123@localhost:5432/postgres";

async function main() {
  const sql = postgres(localUrl);
  const email = "macielsuassuna14@gmail.com";

  try {
    console.log(`>>> Procurando em 'user' por ${email} no banco LOCAL...`);
    const result = await sql`SELECT * FROM "user" WHERE email = ${email}`;
    
    if (result.length > 0) {
      console.log("[ENCONTRADO NO LOCAL]");
      console.table(result);
    } else {
      console.log("[NÃO ENCONTRADO NO LOCAL]");
    }
  } catch (error: any) {
    console.error(`[ERRO LOCAL]:`, error.message || error);
  } finally {
    await sql.end();
  }
}

main();
