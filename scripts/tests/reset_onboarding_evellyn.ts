import { db } from "../src/modules/infrastructure/drizzle/database";
import * as schema from "../src/db/schema";
import { eq } from "drizzle-orm";

async function resetOnboarding() {
  const email = "evellync077@gmail.com";
  console.log(`[RESET] Resetando onboarding para: ${email}`);

  try {
    const [user] = await db
      .select()
      .from(schema.user)
      .where(eq(schema.user.email, email))
      .limit(1);

    if (!user) {
      console.error(`[ERROR] Usuário ${email} não encontrado.`);
      process.exit(1);
    }

    await db
      .update(schema.user)
      .set({ hasCompletedOnboarding: false })
      .where(eq(schema.user.id, user.id));

    console.log(`[SUCCESS] Onboarding resetado com sucesso para ${email}!`);
  } catch (error) {
    console.error("[FATAL] Erro ao resetar onboarding:", error);
  } finally {
    process.exit(0);
  }
}

resetOnboarding();
