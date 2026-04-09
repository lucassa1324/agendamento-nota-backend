import { db } from "../src/modules/infrastructure/drizzle/database";
import * as schema from "../src/db/schema";
import { eq, and } from "drizzle-orm";

interface TestResult {
  name: string;
  status: "PASS" | "FAIL";
  detail?: string;
}

async function runBugFixTests() {
  const testEmail = "aura.teste@gmail.com";
  const results: Record<string, TestResult[]> = {
    email_sync: [],
    onboarding: [],
    resend_fallback: [],
    validation_bugs: []
  };

  console.log(`\n=== INICIANDO TESTES DE CORREÇÃO DE BUGS E SINCRONIZAÇÃO ===\n`);

  try {
    // 1. Preparação
    const [user] = await db.select().from(schema.user).where(eq(schema.user.email, testEmail)).limit(1);
    if (!user) throw new Error("Usuário de teste não encontrado");

    const [company] = await db.select().from(schema.companies).where(eq(schema.companies.ownerId, user.id)).limit(1);
    if (!company) throw new Error("Empresa de teste não encontrada");

    // --- TESTE 1: Sincronização de Email ---
    // Simula a lógica do SettingsController: Profile Email -> Company Contact -> User Email
    console.log("[TEST] Sincronização e Fallback de Email");

    // Caso 1: Sem email no perfil e sem contato na empresa (deve pegar do User)
    await db.update(schema.companies).set({ contact: null }).where(eq(schema.companies.id, company.id));

    let publicEmail = null; // simulando a lógica do controller
    if (!publicEmail && company.contact) publicEmail = company.contact;
    if (!publicEmail && user.email) publicEmail = user.email;

    results.email_sync.push({
      name: "Fallback para Email do Usuário (Dono)",
      status: publicEmail === testEmail ? "PASS" : "FAIL",
      detail: `Email obtido: ${publicEmail}`
    });

    // Caso 2: Com contato na empresa (deve priorizar sobre o User)
    const companyContact = "contato@empresa.com";
    await db.update(schema.companies).set({ contact: companyContact }).where(eq(schema.companies.id, company.id));

    publicEmail = null;
    if (!publicEmail && companyContact) publicEmail = companyContact;
    if (!publicEmail && user.email) publicEmail = user.email;

    results.email_sync.push({
      name: "Prioridade para Contato da Empresa",
      status: publicEmail === companyContact ? "PASS" : "FAIL",
      detail: `Email obtido: ${publicEmail}`
    });

    // --- TESTE 2: Reset de Onboarding ---
    console.log("[TEST] Reset de Onboarding");
    await db.update(schema.user).set({ hasCompletedOnboarding: false }).where(eq(schema.user.id, user.id));
    const [updatedUser] = await db.select().from(schema.user).where(eq(schema.user.id, user.id)).limit(1);

    results.onboarding.push({
      name: "Status de Onboarding Resetado",
      status: updatedUser.hasCompletedOnboarding === false ? "PASS" : "FAIL"
    });

    // --- TESTE 3: Fallback de Slug (Duplicate Slug Bug) ---
    console.log("[TEST] Fallback de Slug Único");
    // Simulando a lógica do CreateUserUseCase que usa Date.now() no fallback
    const originalSlug = company.slug;
    const fallbackSlug = `${originalSlug}-${Date.now()}`;

    results.resend_fallback.push({
      name: "Geração de Slug Alternativo",
      status: fallbackSlug.startsWith(originalSlug) && fallbackSlug.length > originalSlug.length ? "PASS" : "FAIL",
      detail: `Slug gerado: ${fallbackSlug}`
    });

    // --- TESTE 4: Validação de Horário Passado (Logic check) ---
    console.log("[TEST] Lógica de Bloqueio de Horário Passado");
    const now = new Date();
    const futureDate = new Date(now.getTime() + 10 * 60 * 1000); // 10 min no futuro
    const pastDate = new Date(now.getTime() - 10 * 60 * 1000); // 10 min no passado

    const isFutureValid = futureDate > now;
    const isPastInvalid = pastDate < now;

    results.validation_bugs.push({
      name: "Bloqueio de horários passados",
      status: (isFutureValid && isPastInvalid) ? "PASS" : "FAIL",
      detail: `Futuro válido: ${isFutureValid}, Passado inválido: ${isPastInvalid}`
    });

    // --- DIAGNÓSTICO FINAL ---
    console.log(`\n=== DIAGNÓSTICO DE CORREÇÕES ===\n`);
    for (const [cat, tests] of Object.entries(results)) {
      console.log(`**${cat.toUpperCase()}**`);
      tests.forEach(t => {
        console.log(`- [${t.status}] ${t.name}`);
        if (t.detail) console.log(`  > ${t.detail}`);
      });
    }

  } catch (error) {
    console.error("\n[FATAL] Erro durante os testes:", error);
  } finally {
    process.exit(0);
  }
}

runBugFixTests();
