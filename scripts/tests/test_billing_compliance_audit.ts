import { access, readFile } from "node:fs/promises";
import path from "node:path";

type AuditResult = {
  key: string;
  status: "PASS" | "FAIL";
  detail: string;
};

const repoRoot = path.resolve(process.cwd(), "..");

const backendWebhookPath = path.join(
  repoRoot,
  "back_end",
  "src",
  "modules",
  "infrastructure",
  "payment",
  "asaas.webhook.controller.ts",
);
const backendAuthPath = path.join(
  repoRoot,
  "back_end",
  "src",
  "modules",
  "infrastructure",
  "auth",
  "auth-plugin.ts",
);
const backendMasterAdminPath = path.join(
  repoRoot,
  "back_end",
  "src",
  "modules",
  "business",
  "adapters",
  "in",
  "http",
  "master-admin.controller.ts",
);
const frontendSignupPath = path.join(
  repoRoot,
  "front_end",
  "src",
  "components",
  "admin",
  "signup-form.tsx",
);
const frontendBlockScreenPath = path.join(
  repoRoot,
  "front_end",
  "src",
  "components",
  "admin",
  "subscription-block-screen.tsx",
);
const frontendTermsPagePath = path.join(
  repoRoot,
  "front_end",
  "src",
  "app",
  "termos-de-uso",
  "page.tsx",
);
const frontendPrivacyPagePath = path.join(
  repoRoot,
  "front_end",
  "src",
  "app",
  "politica-de-privacidade",
  "page.tsx",
);

const assert = (condition: boolean, passDetail: string, failDetail: string): AuditResult => ({
  key: "",
  status: condition ? "PASS" : "FAIL",
  detail: condition ? passDetail : failDetail,
});

async function fileExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function runAudit() {
  const results: AuditResult[] = [];

  const [webhookContent, authContent, masterAdminContent, signupContent, blockScreenContent] = await Promise.all([
    readFile(backendWebhookPath, "utf8"),
    readFile(backendAuthPath, "utf8"),
    readFile(backendMasterAdminPath, "utf8"),
    readFile(frontendSignupPath, "utf8"),
    readFile(frontendBlockScreenPath, "utf8"),
  ]);

  // 1) Cancelamento no Asaas bloqueia no banco local
  {
    const hasCancellationEvents = /SUBSCRIPTION_DELETED|SUBSCRIPTION_CANCELED|SUBSCRIPTION_CANCELLED|SUBSCRIPTION_INACTIVATED/.test(
      webhookContent,
    );
    const setsCanceledState =
      /subscriptionStatus:\s*"canceled"/.test(webhookContent) &&
      /active:\s*false/.test(webhookContent);
    const deactivatesOwner =
      /\.update\(user\)[\s\S]*active:\s*false/.test(webhookContent);

    const check = assert(
      hasCancellationEvents && setsCanceledState && deactivatesOwner,
      "Webhook cobre cancelamento de assinatura e bloqueia empresa/dono localmente.",
      "Webhook não demonstra cobertura completa para cancelamento de assinatura no Asaas.",
    );
    check.key = "Cancelamento Asaas -> Bloqueio local";
    results.push(check);
  }

  // 2) Regra de carência e bloqueio
  {
    const hasGraceDays = /BILLING_GRACE_DAYS\s*=\s*7/.test(webhookContent);
    const setsGraceStatus =
      /subscriptionStatus:\s*isStillInGrace \? 'grace_period' : 'past_due'/.test(
        webhookContent,
      );
    const keepsActiveDuringGrace = /active:\s*isStillInGrace/.test(webhookContent);

    const check = assert(
      hasGraceDays && setsGraceStatus && keepsActiveDuringGrace,
      "Falha de pagamento entra em carência de 7 dias com acesso ativo durante grace_period.",
      "Regra de carência/bloqueio não está consistente com 7 dias e ativação condicional.",
    );
    check.key = "Carência por falha de pagamento";
    results.push(check);
  }

  // 3) Login bloqueado orienta para checkout
  {
    const hasBillingRequired = /BILLING_REQUIRED/.test(authContent) && /set\.status\s*=\s*402/.test(authContent);
    const hasCheckoutFlow =
      /\/api\/asaas\/create-payment-link/.test(blockScreenContent) &&
      /window\.location\.href\s*=\s*data\.url/.test(blockScreenContent);

    const check = assert(
      hasBillingRequired && hasCheckoutFlow,
      "Fluxo de login bloqueia por cobrança (402) e tela direciona para checkout Asaas.",
      "Não foi encontrada evidência completa de bloqueio 402 + redirecionamento ao checkout.",
    );
    check.key = "Bloqueio no login + Checkout";
    results.push(check);
  }

  // 4) Logs de auditoria para ações críticas
  {
    const hasPricingLog = /MASTER_ADMIN_UPDATE_PRICING/.test(masterAdminContent);
    const hasDeletionLogs =
      /MASTER_ADMIN_DELETE_USER/.test(masterAdminContent) &&
      /MASTER_ADMIN_DELETE_PROSPECT/.test(masterAdminContent) &&
      /MASTER_ADMIN_DELETE_BUG_REPORT/.test(masterAdminContent);

    const check = assert(
      hasPricingLog && hasDeletionLogs,
      "writeSystemLog cobre alteração de preço e exclusões críticas no master admin.",
      "Faltam logs críticos esperados para alteração de preço e/ou exclusões.",
    );
    check.key = "Audit logs de ações críticas";
    results.push(check);
  }

  // 5) Termos e Política no cadastro
  {
    const hasLegalCheckbox =
      /acceptedLegalTerms/.test(signupContent) &&
      /Termos de Uso/.test(signupContent) &&
      /Política de Privacidade/.test(signupContent) &&
      /href="\/termos-de-uso"/.test(signupContent) &&
      /href="\/politica-de-privacidade"/.test(signupContent) &&
      /acceptedTerms:\s*true/.test(signupContent); // Garante que envia para o backend
    const [hasTermsPage, hasPrivacyPage] = await Promise.all([
      fileExists(frontendTermsPagePath),
      fileExists(frontendPrivacyPagePath),
    ]);

    const check = assert(
      hasLegalCheckbox && hasTermsPage && hasPrivacyPage,
      "Cadastro exige aceite e possui páginas públicas de Termos e Política.",
      "Aceite legal no cadastro e/ou páginas de Termos/Política estão incompletos.",
    );
    check.key = "Termos e Privacidade no cadastro";
    results.push(check);
  }

  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.length - passed;

  console.log("\n=== AUDITORIA DE COBRANÇA E COMPLIANCE ===\n");
  for (const result of results) {
    console.log(`[${result.status}] ${result.key}`);
    console.log(`- ${result.detail}`);
  }
  console.log(`\nResumo: ${passed} PASS | ${failed} FAIL\n`);

  process.exit(failed > 0 ? 1 : 0);
}

runAudit().catch((error) => {
  console.error("[AUDIT_FATAL]:", error);
  process.exit(1);
});
