
import postgres from "postgres";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(__dirname, ".env.local") });

// --- CONFIGURAÇÃO ---
const SOURCE_URL = process.env.DATABASE_URL; // URL do Neon (Cloud)
const TARGET_URL = "postgres://postgres:admin123@localhost:5432/postgres"; // URL Local (Docker)

if (!SOURCE_URL) {
  console.error("❌ Erro: DATABASE_URL (Neon) não encontrado no .env.local");
  process.exit(1);
}

const source = postgres(SOURCE_URL, { ssl: "require" });
const target = postgres(TARGET_URL);

// --- ORDEM DE MIGRAÇÃO (Respeitando FKs) ---
const MIGRATION_ORDER = [
  // Nível 1: Base
  "user",
  
  // Nível 2: Dependem de User
  "companies",
  "account",
  "verification",
  "prospects",
  "push_subscriptions",
  
  // Nível 3: Dependem de Company
  "services",
  "inventory",
  "fixed_expenses",
  "operating_hours",
  "google_calendar_configs",
  "business_profiles",
  "company_site_customizations",
  "site_drafts",
  "gallery_images",
  "agenda_blocks",
  
  // Nível 4: Dependem de Service/Company/User
  "appointments",
  "inventory_logs",
  
  // Nível 5: Relacionamentos Cruzados
  "service_resources",
  "appointment_items"
];

async function migrateTable(tableName: string) {
  console.log(`\n📦 Migrando tabela: [${tableName}]...`);
  
  try {
    // 1. Buscar dados da origem
    const rows = await source.unsafe(`SELECT * FROM "${tableName}"`);
    
    if (rows.length === 0) {
      console.log(`ℹ️ Tabela [${tableName}] está vazia na origem.`);
      return 0;
    }

    console.log(`➡️ Lendo ${rows.length} registros da nuvem...`);

    // 2. Inserir no destino com tratamento de conflito
    // Usamos ON CONFLICT DO NOTHING para evitar erros com dados já existentes (como aura.teste)
    let migratedCount = 0;
    
    // Inserção em lotes para performance
    const batchSize = 100;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      
      // Construir query dinâmica para INSERT ... ON CONFLICT DO NOTHING
      // Nota: Assume-se que a PK é 'id'. Se houver tabelas sem ID ou com PK composta, 
      // o ON CONFLICT DO NOTHING sem alvo específico funciona em versões recentes do Postgres.
      try {
        await target.unsafe(`
          INSERT INTO "${tableName}" ${target(batch)} 
          ON CONFLICT DO NOTHING
        `);
        migratedCount += batch.length;
      } catch (err: any) {
        console.error(`❌ Erro no lote da tabela [${tableName}]:`, err.message);
      }
    }

    console.log(`✅ Tabela [${tableName}] migrada! Total: ${migratedCount} registros.`);
    return migratedCount;

  } catch (error: any) {
    console.error(`❌ Erro crítico ao migrar [${tableName}]:`, error.message);
    return 0;
  }
}

async function startMigration() {
  const startTime = Date.now();
  const summary: Record<string, number> = {};

  console.log("🚀 INICIANDO MIGRAÇÃO: NEON (CLOUD) -> DOCKER (LOCAL)");
  console.log("---------------------------------------------------");

  try {
    for (const table of MIGRATION_ORDER) {
      const count = await migrateTable(table);
      summary[table] = count;
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log("\n===================================================");
    console.log("🏆 MIGRAÇÃO CONCLUÍDA COM SUCESSO!");
    console.log(`⏱️ Tempo total: ${duration}s`);
    console.log("---------------------------------------------------");
    console.table(summary);
    console.log("===================================================");
    console.log("💡 Nota: As sessões foram ignoradas propositalmente.");
    
  } catch (error: any) {
    console.error("\n💥 FALHA FATAL NA MIGRAÇÃO:", error.message);
  } finally {
    await source.end();
    await target.end();
    process.exit();
  }
}

startMigration();
