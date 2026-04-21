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
    console.log(`>>> Procurando em TODAS as tabelas do banco de produção por ${email}...`);
    
    const tables = ["user", "prospects", "account", "session"];
    for (const table of tables) {
      try {
        const result = await sql.unsafe(`SELECT * FROM "${table}" WHERE email = '${email}' OR id = '${email}'`);
        if (result.length > 0) {
          console.log(`[TABELA ${table}]: ENCONTRADO!`);
          console.table(result);
        } else {
          console.log(`[TABELA ${table}]: Não encontrado.`);
        }
      } catch (e) {}
    }

    console.log(`>>> Verificando schemas...`);
    const schemas = await sql`SELECT schema_name FROM information_schema.schemata`;
    console.table(schemas);

  } catch (error: any) {
    console.error(`[ERRO]:`, error.message || error);
  } finally {
    await sql.end();
  }
}

main();
