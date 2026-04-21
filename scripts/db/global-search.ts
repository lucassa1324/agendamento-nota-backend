import postgres from "postgres";
import dotenv from "dotenv";

dotenv.config({ path: ".env.production" });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL não definida em .env.production");
}

async function main() {
  const sql = postgres(connectionString!);
  const searchTerm = "maciel";

  try {
    console.log(`>>> Busca global por '${searchTerm}' em TODAS as tabelas e colunas...`);
    
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;

    for (const { table_name } of tables) {
      const columns = await sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = ${table_name} 
        AND (data_type = 'text' OR data_type = 'character varying')
      `;

      if (columns.length === 0) continue;

      for (const { column_name } of columns) {
        try {
          const result = await sql.unsafe(`
            SELECT * FROM "${table_name}" 
            WHERE "${column_name}" ILIKE '%${searchTerm}%'
          `);

          if (result.length > 0) {
            console.log(`\n[ENCONTRADO] Tabela: ${table_name}, Coluna: ${column_name}`);
            console.table(result);
          }
        } catch (e) {
          // Ignorar erros em tabelas específicas
        }
      }
    }
    
    console.log("\n>>> Busca concluída.");

  } catch (error: any) {
    console.error(`[ERRO]:`, error.message || error);
  } finally {
    await sql.end();
  }
}

main();
