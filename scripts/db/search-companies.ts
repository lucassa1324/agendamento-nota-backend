import postgres from "postgres";
import dotenv from "dotenv";

dotenv.config({ path: ".env.production" });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL não definida em .env.production");
}

async function main() {
  const sql = postgres(connectionString!);
  const searchTerm = "%maciel%";

  try {
    console.log(`>>> Procurando em 'companies' por ${searchTerm}...`);
    const companies = await sql`
      SELECT id, name, owner_id FROM "companies" 
      WHERE name ILIKE ${searchTerm}
    `;
    console.table(companies);

    console.log(">>> Listando TODAS as empresas para conferência manual...");
    const allCompanies = await sql`SELECT id, name, owner_id FROM "companies"`;
    console.table(allCompanies);

  } catch (error: any) {
    console.error(`[ERRO]:`, error.message || error);
  } finally {
    await sql.end();
  }
}

main();
