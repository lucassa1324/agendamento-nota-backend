
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(__dirname, ".env.local") });

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.error("DATABASE_URL não encontrado no .env.local");
  process.exit(1);
}

async function analyzeStorage() {
  const queryClient = postgres(dbUrl as string, { prepare: false });

  try {
    console.log("--- ANALISANDO TAMANHO DAS TABELAS (STORAGE) ---");
    
    // Consulta para ver o tamanho de cada tabela no banco de dados
    const tableSizes = await queryClient.unsafe(`
      SELECT 
        relname AS table_name,
        pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
        pg_size_pretty(pg_relation_size(relid)) AS table_size,
        pg_size_pretty(pg_total_relation_size(relid) - pg_relation_size(relid)) AS index_size
      FROM pg_catalog.pg_statio_user_tables
      ORDER BY pg_total_relation_size(relid) DESC;
    `);

    console.table(tableSizes);

    console.log("\n--- ANALISANDO CONTAGEM DE REGISTROS ---");
    const counts = await queryClient.unsafe(`
      SELECT 
        schemaname, 
        relname, 
        n_live_tup 
      FROM pg_stat_user_tables 
      ORDER BY n_live_tup DESC;
    `);
    console.table(counts);

  } catch (error: any) {
    console.error("❌ Erro ao analisar banco:", error.message);
  } finally {
    await queryClient.end();
    process.exit();
  }
}

analyzeStorage();
