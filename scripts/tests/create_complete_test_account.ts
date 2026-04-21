import { db } from "../src/modules/infrastructure/drizzle/database";
import * as schema from "../src/db/schema";
import { eq } from "drizzle-orm";

async function createTestAccount() {
  const testEmail = "aura.teste@gmail.com";
  const password = "Mudar@123";
  const userName = "Usuário Teste Aura";
  const studioName = "Studio de Teste Aura";
  const slug = "studio-teste-aura";

  console.log(`[TEST_ACCOUNT] Iniciando criação da conta de teste: ${testEmail}`);

  try {
    // 1. Limpar se já existir
    const [existingUser] = await db
      .select()
      .from(schema.user)
      .where(eq(schema.user.email, testEmail))
      .limit(1);

    if (existingUser) {
      console.log("[TEST_ACCOUNT] Removendo conta de teste antiga...");
      await db.delete(schema.account).where(eq(schema.account.userId, existingUser.id));
      await db.delete(schema.companies).where(eq(schema.companies.ownerId, existingUser.id));
      await db.delete(schema.user).where(eq(schema.user.id, existingUser.id));
    }

    // 2. Criar Usuário
    const userId = crypto.randomUUID();
    const [newUser] = await db.insert(schema.user).values({
      id: userId,
      name: userName,
      email: testEmail,
      role: "ADMIN",
      active: true,
      hasCompletedOnboarding: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    // 3. Criar Conta (Credenciais)
    const hashedPassword = await Bun.password.hash(password, { algorithm: "argon2id" });
    await db.insert(schema.account).values({
      id: crypto.randomUUID(),
      userId: newUser.id,
      accountId: testEmail,
      providerId: "credential",
      password: hashedPassword,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // 4. Criar Empresa (Company)
    const companyId = crypto.randomUUID();
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 30); // 30 dias de teste

    await db.insert(schema.companies).values({
      id: companyId,
      name: studioName,
      slug: slug,
      ownerId: newUser.id,
      active: true,
      subscriptionStatus: "trial",
      trialEndsAt: trialEndsAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // 5. Criar Customização do Site
    await db.insert(schema.companySiteCustomizations).values({
      id: crypto.randomUUID(),
      companyId: companyId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log("-----------------------------------------");
    console.log("[SUCCESS] Conta de Teste Criada!");
    console.log(`Email: ${testEmail}`);
    console.log(`Senha: ${password}`);
    console.log(`Slug do Studio: ${slug}`);
    console.log("-----------------------------------------");

  } catch (error) {
    console.error("[FATAL] Erro ao criar conta de teste:", error);
  } finally {
    process.exit(0);
  }
}

createTestAccount();
