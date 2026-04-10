
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./src/db/schema";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(__dirname, ".env.local") });

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.error("DATABASE_URL não encontrado no .env.local");
  process.exit(1);
}

async function cleanSessions() {
  const queryClient = postgres(dbUrl as string, { prepare: false });
  const db = drizzle(queryClient);

  try {
    console.log("--- INICIANDO LIMPEZA DA TABELA DE SESSÕES ---");

    // Deletar todas as sessões
    // Se o banco estiver travado por cota de TRANSFERÊNCIA, este comando pode falhar
    // mas se for por cota de ARMAZENAMENTO, ele ajuda a liberar espaço.
    const result = await queryClient.unsafe('DELETE FROM "session"');

    console.log("✅ Limpeza concluída com sucesso!");
    console.log(`Nota: Todas as sessões foram removidas. Usuários precisarão fazer login novamente.`);

  } catch (error: any) {
    console.error("❌ Erro ao limpar sessões:", error.message);
    if (error.message.includes("quota")) {
      console.log("\n⚠️ ALERTA: O banco continua bloqueando comandos devido à cota excedida.");
      console.log("Você PRECISA aumentar o limite no painel do provedor (Neon/Supabase) antes de qualquer comando de escrita funcionar.");
    }
  } finally {
    await queryClient.end();
    process.exit();
  }
}

cleanSessions();
