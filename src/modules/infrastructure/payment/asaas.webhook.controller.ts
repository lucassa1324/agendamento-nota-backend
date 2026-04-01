import { Elysia } from "elysia";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "../drizzle/database";
import { companies, user } from "../../../db/schema";
import { eq } from "drizzle-orm";

const normalizeEnvValue = (value?: string) =>
  value?.trim().replace(/^['"]|['"]$/g, "") || "";

const extractEnvValueFromContent = (content: string, key: string) => {
  const regex = new RegExp(`^${key}=(.*)$`, "m");
  const match = content.match(regex);
  if (!match?.[1]) {
    return "";
  }
  return normalizeEnvValue(match[1]);
};

const readEnvFallback = async (key: string) => {
  const candidates = [
    path.join(process.cwd(), ".env"),
    path.join(process.cwd(), ".env.local"),
    path.join(process.cwd(), "back_end", ".env"),
    path.join(process.cwd(), "back_end", ".env.local"),
    path.join(process.cwd(), "front_end", ".env.local"),
    path.join(process.cwd(), "..", "back_end", ".env"),
    path.join(process.cwd(), "..", "back_end", ".env.local"),
    path.join(process.cwd(), "..", "front_end", ".env.local"),
  ];

  for (const envPath of candidates) {
    try {
      const content = await readFile(envPath, "utf8");
      const value = extractEnvValueFromContent(content, key);
      if (value) {
        return value;
      }
    } catch {}
  }

  return "";
};

export const asaasWebhookController = new Elysia({ prefix: "/webhook/asaas" })
  .post("/", async ({ request, set }) => {
    try {
      const event = await request.json() as any;
      console.log(`[ASAAS_WEBHOOK] Evento recebido: ${event.event}`, event);

      // Validação básica de segurança (Token no header se houver)
      const asaasToken = request.headers.get("asaas-access-token");
      if (process.env.ASAAS_WEBHOOK_TOKEN && asaasToken !== process.env.ASAAS_WEBHOOK_TOKEN) {
        console.warn("[ASAAS_WEBHOOK] Token de segurança inválido!");
        set.status = 401;
        return { error: "Unauthorized" };
      }

      if (!event || !event.payment) {
        return { status: "ignored", reason: "no_payment_data" };
      }

      const payment = event.payment;
      const activationEvents = [
        "PAYMENT_CONFIRMED",
        "PAYMENT_RECEIVED",
        "PAYMENT_RECEIVED_IN_CASH",
      ];
      const blockingEvents = ["PAYMENT_OVERDUE", "PAYMENT_REFUNDED"];

      const asaasApiKey =
        normalizeEnvValue(process.env.ASAAS_API_KEY) ||
        normalizeEnvValue(process.env.ASAAS_ACCESS_TOKEN) ||
        (await readEnvFallback("ASAAS_API_KEY")) ||
        (await readEnvFallback("ASAAS_ACCESS_TOKEN"));
      const asaasApiUrl =
        normalizeEnvValue(process.env.ASAAS_API_URL) ||
        normalizeEnvValue(process.env.ASAAS_BASE_URL) ||
        (await readEnvFallback("ASAAS_API_URL")) ||
        (await readEnvFallback("ASAAS_BASE_URL")) ||
        "https://api-sandbox.asaas.com/v3";

      let externalReference = payment.externalReference;

      if (!externalReference && payment.subscription && asaasApiKey) {
        try {
          const subscriptionResponse = await fetch(
            `${asaasApiUrl}/subscriptions/${payment.subscription}`,
            {
              method: "GET",
              headers: {
                access_token: asaasApiKey,
              },
            },
          );
          if (subscriptionResponse.ok) {
            const subscriptionData = await subscriptionResponse.json() as {
              externalReference?: string;
            };
            externalReference = subscriptionData.externalReference;
          }
        } catch (subscriptionError) {
          console.error("[ASAAS_WEBHOOK] Falha ao buscar assinatura para recuperar externalReference:", subscriptionError);
        }
      }

      // Tenta encontrar a empresa pelo externalReference (que é o businessId)
      if (activationEvents.includes(event.event)) {
        // Lógica de Ativação
        if (externalReference) {
          console.log(`[ASAAS_WEBHOOK] Processando ativação para empresa: ${externalReference}`);

          const paymentDate = payment.paymentDate ? new Date(payment.paymentDate) : new Date();
          const nextDue = new Date(paymentDate);
          nextDue.setDate(nextDue.getDate() + 30);

          // 1. Buscar a empresa para obter o ownerId
          const [company] = await db.select()
            .from(companies)
            .where(eq(companies.id, externalReference))
            .limit(1);

          if (company) {
            if (company.active === false) {
              console.warn(`[ASAAS_WEBHOOK] Empresa ${company.name} está bloqueada manualmente (active=false). Ativação automática ignorada.`);
              return { received: true, skipped: "manual_block" };
            }

            const isManualGraceActive =
              company.accessType === "manual" &&
              !!company.trialEndsAt &&
              new Date(company.trialEndsAt) > new Date();

            // 2. Atualizar a empresa
            await db.update(companies)
              .set({
                subscriptionStatus: 'active',
                active: true,
                accessType: isManualGraceActive ? 'manual' : 'automatic',
                trialEndsAt: isManualGraceActive ? company.trialEndsAt : nextDue,
                updatedAt: new Date()
              })
              .where(eq(companies.id, externalReference));

            // 3. Ativar o dono da empresa também
            await db.update(user)
              .set({
                active: true,
                updatedAt: new Date()
              })
              .where(eq(user.id, company.ownerId));

            console.log(`[ASAAS_WEBHOOK] Pagamento confirmado! Empresa ${company.name} (${externalReference}) e dono ${company.ownerId} ativados até ${nextDue.toISOString()}.`);
          } else {
            console.warn(`[ASAAS_WEBHOOK] Empresa ${externalReference} não encontrada.`);
          }
        } else {
          console.warn("[ASAAS_WEBHOOK] ExternalReference ausente, não foi possível identificar a empresa.");
        }
      } else if (blockingEvents.includes(event.event)) {
        // Lógica de Bloqueio
        if (externalReference) {
          const [company] = await db.select()
            .from(companies)
            .where(eq(companies.id, externalReference))
            .limit(1);

          if (!company) {
            console.warn(`[ASAAS_WEBHOOK] Empresa ${externalReference} não encontrada para bloqueio.`);
            return { received: true };
          }

          if (company.active === false) {
            console.warn(`[ASAAS_WEBHOOK] Empresa ${company.name} já está bloqueada manualmente (active=false).`);
            return { received: true, skipped: "manual_block" };
          }

          const hasManualOverride =
            (company.accessType === "manual" || company.accessType === "extended_trial") &&
            !!company.trialEndsAt &&
            new Date(company.trialEndsAt) > new Date();

          if (hasManualOverride) {
            console.log(`[ASAAS_WEBHOOK] Bloqueio ignorado para ${company.name} por override manual ativo até ${company.trialEndsAt?.toISOString?.() || company.trialEndsAt}.`);
            return { received: true, skipped: "manual_override" };
          }

          await db.update(companies)
            .set({
              subscriptionStatus: 'past_due',
              updatedAt: new Date()
            })
            .where(eq(companies.id, externalReference));
          console.log(`[ASAAS_WEBHOOK] Pagamento pendente/estornado. Empresa ${externalReference} marcada como past_due.`);
        }
      }

      return { received: true };
    } catch (error: any) {
      console.error("[ASAAS_WEBHOOK_ERROR]", error);
      set.status = 500;
      return { error: "Internal Server Error" };
    }
  });
