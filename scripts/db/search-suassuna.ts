import postgres from "postgres";
import dotenv from "dotenv";

dotenv.config({ path: ".env.production" });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL não definida em .env.production");
}

async function main() {
  const sql = postgres(connectionString!);
  const searchTerm = "%suassuna%";

  try {
    console.log(`>>> Procurando em 'user' por e-mail contendo '${searchTerm}'...`);
    const users = await sql`SELECT id, name, email, role FROM "user" WHERE email ILIKE ${searchTerm}`;
    console.table(users);

    console.log(`>>> Procurando em 'user' por nome contendo '${searchTerm}'...`);
    const usersByName = await sql`SELECT id, name, email, role FROM "user" WHERE name ILIKE ${searchTerm}`;
    console.table(usersByName);

  } catch (error: any) {
    console.error(`[ERRO]:`, error.message || error);
  } finally {
    await sql.end();
  }
}

main();
