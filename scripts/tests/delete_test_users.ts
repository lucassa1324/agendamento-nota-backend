
import { db } from "../src/modules/infrastructure/drizzle/database";
import * as schema from "../src/db/schema";
import { like, or } from "drizzle-orm";

async function deleteTestUsers() {
  console.log("\n--- INICIANDO EXCLUSÃO DE USUÁRIOS DE TESTE ---\n");

  // Padrões de email para deletar baseados no print
  const patterns = [
    "test.payment.%@example.com",
    "updated.%@example.com",
    "test.subscription.%@example.com"
  ];

  try {
    // 1. Buscar os IDs dos usuários que batem com os padrões
    const usersToDelete = await db
      .select({ id: schema.user.id, email: schema.user.email })
      .from(schema.user)
      .where(
        or(
          ...patterns.map(p => like(schema.user.email, p))
        )
      );

    console.log(`Encontrados ${usersToDelete.length} usuários para deletar.`);

    if (usersToDelete.length === 0) {
      console.log("Nenhum usuário encontrado com os padrões informados.");
      process.exit(0);
    }

    const userIds = usersToDelete.map(u => u.id);

    // 2. Deletar em ordem para respeitar chaves estrangeiras (se houver)
    // Primeiro as contas, sessões e outros dados vinculados
    const deletedSessions = await db.delete(schema.session).where(or(...userIds.map(id => like(schema.session.userId, id))));
    const deletedAccounts = await db.delete(schema.account).where(or(...userIds.map(id => like(schema.account.userId, id))));
    
    // Por fim, deletar os usuários
    const deletedUsers = await db.delete(schema.user).where(or(...userIds.map(id => like(schema.user.id, id))));

    console.log(`✅ Sucesso!`);
    console.log(`- Usuários removidos: ${usersToDelete.length}`);
    usersToDelete.forEach(u => console.log(`  > ${u.email}`));

  } catch (error) {
    console.error("❌ Erro ao deletar usuários:", error);
  }

  process.exit(0);
}

deleteTestUsers().catch(err => {
  console.error(err);
  process.exit(1);
});
