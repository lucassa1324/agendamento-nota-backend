import { Elysia } from "elysia";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "../drizzle/database";
import { companies, user } from "../../../db/schema";
import { eq } from "drizzle-orm";
import {
  calculateAnchoredNextBillingDate,
  calculateGraceEndDate,
  resolveBillingAnchorDay,
} from "./billing-dates";

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
    } catch { }
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

      if (!event) {
        return { status: "ignored", reason: "no_event_data" };
      }

      const cancellationEvents = [
        "SUBSCRIPTION_DELETED",
        "SUBSCRIPTION_CANCELED",
        "SUBSCRIPTION_CANCELLED",
        "SUBSCRIPTION_INACTIVATED",
      ];
      const isSubscriptionCancellationEvent = cancellationEvents.includes(event.event);
      const hasPaymentData = !!event.payment;

      if (!hasPaymentData && !isSubscriptionCancellationEvent) {
        return { status: "ignored", reason: "unsupported_event_payload" };
      }

      const payment = event.payment || {};
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

      const fetchAsaasResource = async <T>(resourcePath: string): Promise<T | null> => {
        if (!asaasApiKey) {
          return null;
        }
        try {
          const response = await fetch(`${asaasApiUrl}${resourcePath}`, {
            method: "GET",
            headers: {
              access_token: asaasApiKey,
            },
          });
          if (!response.ok) {
            return null;
          }
          return await response.json() as T;
        } catch {
          return null;
        }
      };

      let externalReference = String(payment.externalReference || "");
      let customerId = String(payment.customer || "");
      let customerEmail = "";

      let subscriptionId = String(
        payment.subscription ||
        event?.subscription?.id ||
        event?.subscription ||
        "",
      );

      if ((!externalReference || !customerId) && subscriptionId) {
        const subscriptionData = await fetchAsaasResource<{ externalReference?: string; customer?: string }>(
          `/subscriptions/${subscriptionId}`,
        );
        if (subscriptionData?.externalReference) {
          externalReference = String(subscriptionData.externalReference);
        }
        if (subscriptionData?.customer) {
          customerId = String(subscriptionData.customer);
        }
      }

      if ((!externalReference || !customerId) && payment.id) {
        const paymentData = await fetchAsaasResource<{ externalReference?: string; customer?: string; subscription?: string }>(
          `/payments/${payment.id}`,
        );
        if (paymentData?.externalReference) {
          externalReference = String(paymentData.externalReference);
        }
        if (paymentData?.customer) {
          customerId = String(paymentData.customer);
        }
        if ((!externalReference || !customerId) && paymentData?.subscription) {
          subscriptionId = String(paymentData.subscription);
          const subscriptionFromPayment = await fetchAsaasResource<{ externalReference?: string; customer?: string }>(
            `/subscriptions/${subscriptionId}`,
          );
          if (subscriptionFromPayment?.externalReference) {
            externalReference = String(subscriptionFromPayment.externalReference);
          }
          if (subscriptionFromPayment?.customer) {
            customerId = String(subscriptionFromPayment.customer);
          }
        }
      }

      if ((!externalReference || !customerEmail) && customerId) {
        const customerData = await fetchAsaasResource<{ externalReference?: string; email?: string }>(
          `/customers/${customerId}`,
        );
        if (customerData?.externalReference) {
          externalReference = String(customerData.externalReference);
        }
        if (customerData?.email) {
          customerEmail = String(customerData.email).trim().toLowerCase();
        }
      }

      if (!externalReference && customerEmail) {
        let ownerByEmail = await db.select({ id: user.id })
          .from(user)
          .where(eq(user.email, customerEmail))
          .limit(1);

        if (ownerByEmail.length === 0) {
          ownerByEmail = await db.select({ id: user.id })
            .from(user)
            .where(eq(user.email, customerEmail.trim()))
            .limit(1);
        }

        const ownerId = ownerByEmail[0]?.id;
        if (ownerId) {
          const [companyByOwner] = await db.select({ id: companies.id })
            .from(companies)
            .where(eq(companies.ownerId, ownerId))
            .limit(1);
          if (companyByOwner?.id) {
            externalReference = companyByOwner.id;
          }
        }
      }

      // Tenta encontrar a empresa pelo externalReference (que é o businessId)
      if (activationEvents.includes(event.event)) {
        // Lógica de Ativação
        if (externalReference) {
          console.log(`[ASAAS_WEBHOOK] Processando ativação para empresa: ${externalReference}`);

          const paidAtRaw =
            payment.paymentDate || payment.confirmedDate || payment.clientPaymentDate;
          const paymentDate = paidAtRaw ? new Date(paidAtRaw) : new Date();

          // 1. Buscar a empresa para obter o ownerId
          const [company] = await db.select()
            .from(companies)
            .where(eq(companies.id, externalReference))
            .limit(1);

          if (company) {
            if (company.active === false && company.accessType !== "automatic") {
              console.warn(`[ASAAS_WEBHOOK] Empresa ${company.name} está bloqueada manualmente (active=false). Ativação automática ignorada.`);
              return { received: true, skipped: "manual_block" };
            }

            const isManualGraceActive =
              company.accessType === "manual" &&
              !!company.trialEndsAt &&
              new Date(company.trialEndsAt) > new Date();
            const resolvedAnchorDay = resolveBillingAnchorDay(company.billingAnchorDay);
            const nextDue = calculateAnchoredNextBillingDate(paymentDate, resolvedAnchorDay);

            // 2. Atualizar a empresa
            await db.update(companies)
              .set({
                subscriptionStatus: 'active',
                active: true,
                accessType: isManualGraceActive ? 'manual' : 'automatic',
                asaasSubscriptionId: subscriptionId || company.asaasSubscriptionId,
                billingAnchorDay: resolvedAnchorDay,
                billingGraceEndsAt: null,
                trialEndsAt: isManualGraceActive ? company.trialEndsAt : nextDue,
                firstSubscriptionAt: company.firstSubscriptionAt || paymentDate,
                blockedAt: null,
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

          if (company.active === false && company.accessType !== "automatic") {
            console.warn(`[ASAAS_WEBHOOK] Empresa ${company.name} já está bloqueada manualmente (active=false).`);
            return { received: true, skipped: "manual_block" };
          }

          const hasManualOverride =
            (company.accessType === "manual" || company.accessType === "extended_trial") &&
            !!company.trialEndsAt &&
            new Date(company.trialEndsAt) > new Date();

          const isManualOrExtendedExpired =
            (company.accessType === "manual" || company.accessType === "extended_trial") &&
            !!company.trialEndsAt &&
            new Date(company.trialEndsAt) <= new Date();

          if (hasManualOverride) {
            console.log(`[ASAAS_WEBHOOK] Bloqueio ignorado para ${company.name} por override manual ativo até ${company.trialEndsAt?.toISOString?.() || company.trialEndsAt}.`);
            return { received: true, skipped: "manual_override" };
          }

          if (isManualOrExtendedExpired) {
            const subscriptionToCheck = subscriptionId || company.asaasSubscriptionId || "";
            const gatewaySubscription = subscriptionToCheck
              ? await fetchAsaasResource<{ status?: string; nextDueDate?: string }>(`/subscriptions/${subscriptionToCheck}`)
              : null;
            const hasActiveGatewaySubscription = gatewaySubscription?.status === "ACTIVE";

            if (hasActiveGatewaySubscription) {
              const paidAtRaw = gatewaySubscription?.nextDueDate || payment.paymentDate || payment.confirmedDate;
              const paidAt = paidAtRaw ? new Date(paidAtRaw) : new Date();
              const anchor = resolveBillingAnchorDay(company.billingAnchorDay);
              const nextDue = calculateAnchoredNextBillingDate(paidAt, anchor);
              await db.update(companies)
                .set({
                  subscriptionStatus: "active",
                  active: true,
                  accessType: "automatic",
                  trialEndsAt: nextDue,
                  billingAnchorDay: anchor,
                  billingGraceEndsAt: null,
                  blockedAt: null,
                  updatedAt: new Date(),
                })
                .where(eq(companies.id, externalReference));
              await db.update(user)
                .set({
                  active: true,
                  updatedAt: new Date(),
                })
                .where(eq(user.id, company.ownerId));
              console.log(`[ASAAS_WEBHOOK] Modo manual/teste expirado, porém assinatura ativa detectada para ${company.name}. Reativado em automático.`);
              return { received: true, status: "active_after_manual_expiration" };
            }

            await db.update(companies)
              .set({
                subscriptionStatus: "blocked",
                active: false,
                billingGraceEndsAt: null,
                blockedAt: new Date(),
                updatedAt: new Date(),
              })
              .where(eq(companies.id, externalReference));
            await db.update(user)
              .set({
                active: false,
                updatedAt: new Date(),
              })
              .where(eq(user.id, company.ownerId));
            console.log(`[ASAAS_WEBHOOK] Modo manual/teste expirado sem pagamento ativo no gateway. Empresa ${company.name} bloqueada sem carência.`);
            return { received: true, status: "blocked_manual_expired" };
          }

          const dueDateRaw = payment.dueDate || company.trialEndsAt || new Date();
          const dueDate = new Date(dueDateRaw);
          const normalizedDueDate = Number.isNaN(dueDate.getTime()) ? new Date() : dueDate;
          const graceEndsAt = calculateGraceEndDate(normalizedDueDate);
          const isStillInGrace = new Date() <= graceEndsAt;

          await db.update(companies)
            .set({
              subscriptionStatus: isStillInGrace ? 'grace_period' : 'blocked',
              active: isStillInGrace,
              trialEndsAt: normalizedDueDate,
              billingGraceEndsAt: graceEndsAt,
              blockedAt: isStillInGrace ? null : new Date(),
              updatedAt: new Date()
            })
            .where(eq(companies.id, externalReference));
          await db.update(user)
            .set({
              active: isStillInGrace,
              updatedAt: new Date(),
            })
            .where(eq(user.id, company.ownerId));
          console.log(`[ASAAS_WEBHOOK] Pagamento pendente/estornado. Empresa ${externalReference} marcada como ${isStillInGrace ? "grace_period" : "blocked"} até ${graceEndsAt.toISOString()}.`);
        }
      } else if (isSubscriptionCancellationEvent) {
        if (!externalReference) {
          console.warn("[ASAAS_WEBHOOK] Evento de cancelamento sem externalReference. Não foi possível bloquear localmente.");
          return { received: true, skipped: "missing_external_reference" };
        }

        const [company] = await db.select()
          .from(companies)
          .where(eq(companies.id, externalReference))
          .limit(1);

        if (!company) {
          console.warn(`[ASAAS_WEBHOOK] Empresa ${externalReference} não encontrada para cancelamento.`);
          return { received: true };
        }

        const now = new Date();
        const anchoredCycleEndsAt = calculateAnchoredNextBillingDate(
          now,
          resolveBillingAnchorDay(company.billingAnchorDay),
        );
        const currentCycleEndsAt =
          company.trialEndsAt && new Date(company.trialEndsAt).getTime() > now.getTime()
            ? new Date(company.trialEndsAt)
            : anchoredCycleEndsAt;
        const keepAccessUntilCycleEnd = currentCycleEndsAt.getTime() > now.getTime();

        await db.update(companies)
          .set({
            subscriptionStatus: keepAccessUntilCycleEnd ? "pending_cancellation" : "canceled",
            active: keepAccessUntilCycleEnd,
            asaasSubscriptionId: subscriptionId || company.asaasSubscriptionId,
            trialEndsAt: keepAccessUntilCycleEnd ? currentCycleEndsAt : now,
            billingGraceEndsAt: null,
            blockedAt: keepAccessUntilCycleEnd ? null : new Date(),
            updatedAt: now,
          })
          .where(eq(companies.id, externalReference));

        await db.update(user)
          .set({
            accountStatus: "PENDING_CANCELLATION",
            cancellationRequestedAt: now,
            active: keepAccessUntilCycleEnd,
            updatedAt: now,
          })
          .where(eq(user.id, company.ownerId));

        if (keepAccessUntilCycleEnd) {
          console.log(
            `[ASAAS_WEBHOOK] Assinatura cancelada no Asaas para ${company.name} (${externalReference}), mas acesso mantido até ${currentCycleEndsAt.toISOString()}.`,
          );
        } else {
          console.log(
            `[ASAAS_WEBHOOK] Assinatura cancelada no Asaas. Empresa ${company.name} (${externalReference}) bloqueada localmente.`,
          );
        }
      }

      return { received: true };
    } catch (error: any) {
      console.error("[ASAAS_WEBHOOK_ERROR]", error);
      set.status = 500;
      return { error: "Internal Server Error" };
    }
  });
