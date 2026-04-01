
import { db } from "./modules/infrastructure/drizzle/database";
import * as schema from "./db/schema";
import { like, eq } from "drizzle-orm";

async function simulateBlock() {
  try {
    const [company] = await db.select()
      .from(schema.companies)
      .where(like(schema.companies.name, "%Aura Teste%"))
      .limit(1);

    if (!company) {
      console.log("Empresa 'Aura Teste' não encontrada.");
      process.exit(1);
    }

    console.log(`Bloqueando empresa: ${company.name} (ID: ${company.id})`);

    // 1. Marcar como inadimplente e inativa
    await db.update(schema.companies)
      .set({
        subscriptionStatus: "past_due",
        active: false,
        accessType: "automatic",
        updatedAt: new Date()
      })
      .where(eq(schema.companies.id, company.id));

    // 2. Desativar o dono
    await db.update(schema.user)
      .set({
        active: false,
        updatedAt: new Date()
      })
      .where(eq(schema.user.id, company.ownerId));

    // 3. Matar sessões para forçar re-login/re-auth
    await db.delete(schema.session)
      .where(eq(schema.session.userId, company.ownerId));

    console.log("Simulação de bloqueio concluída com sucesso.");
    process.exit(0);
  } catch (error) {
    console.error("Erro na simulação:", error);
    process.exit(1);
  }
}

simulateBlock();
