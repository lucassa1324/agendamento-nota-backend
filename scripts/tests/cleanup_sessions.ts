
import { db } from "../src/modules/infrastructure/drizzle/database";
import * as schema from "../src/db/schema";
import { desc, notInArray, sql } from "drizzle-orm";

async function cleanupSessions() {
  console.log("\n--- INICIANDO LIMPEZA DE SESSÕES ---\n");

  // 1. Contar total de sessões
  const allSessions = await db.select({ id: schema.session.id }).from(schema.session);
  console.log(`Total de sessões encontradas: ${allSessions.length}`);

  if (allSessions.length <= 10) {
    console.log("Sessões insuficientes para limpeza (limite de 10 não atingido).");
    process.exit(0);
  }

  // 2. Pegar os IDs das 10 sessões mais recentes (baseado na expiração ou criação se disponível)
  // Como o schema do Better Auth usa expiresAt, vamos manter as que expiram mais tarde.
  const topSessions = await db
    .select({ id: schema.session.id })
    .from(schema.session)
    .orderBy(desc(schema.session.expiresAt))
    .limit(10);

  const idsToKeep = topSessions.map(s => s.id);

  // 3. Deletar todas as sessões que NÃO estão no top 10
  const deleteResult = await db
    .delete(schema.session)
    .where(notInArray(schema.session.id, idsToKeep));

  console.log(`✅ Limpeza concluída! Mantivemos as 10 sessões mais recentes.`);
  console.log(`Sessões removidas: ${allSessions.length - 10}`);

  process.exit(0);
}

cleanupSessions().catch(err => {
  console.error("❌ Erro na limpeza:", err);
  process.exit(1);
});
