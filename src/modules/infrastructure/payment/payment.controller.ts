import { Elysia, t } from "elysia";
import { authPlugin } from "../auth/auth-plugin";
import { asaas } from "./asaas.client";

export const paymentController = () => new Elysia({ prefix: "/payment" })
  .use(authPlugin)
  .post("/subscribe", async ({ user, body, request, set }) => {
    try {
      if (!user) {
        set.status = 401;
        return { error: "Não autorizado" };
      }

      const {
        customerId,
        value,
        nextDueDate,
        billingType,
        creditCard,
        creditCardHolderInfo,
      } = body;
      
      // Captura o IP do cliente dos headers
      // O front-end deve enviar o IP do cliente no header 'x-client-ip' ou contar com 'x-forwarded-for'
      const remoteIp = request.headers.get("x-client-ip") || 
                       request.headers.get("x-forwarded-for")?.split(',')[0]?.trim() || 
                       "0.0.0.0";

      console.log(`[PAYMENT_CONTROLLER] Iniciando assinatura para user ${user.id} com IP: ${remoteIp}`);

      if (!remoteIp || remoteIp === "0.0.0.0") {
        console.warn("[PAYMENT_CONTROLLER] IP remoto não detectado ou inválido. O Asaas pode rejeitar transações de cartão.");
      }

      if (
        (!billingType || billingType === "CREDIT_CARD") &&
        (!creditCard || !creditCardHolderInfo)
      ) {
        set.status = 400;
        return {
          error:
            "creditCard e creditCardHolderInfo são obrigatórios para cobrança no cartão.",
        };
      }

      if (billingType === "PIX") {
        set.status = 400;
        return {
          error:
            "Forma de pagamento PIX desabilitada neste fluxo. Utilize apenas cartão de crédito.",
        };
      }

      const subscription = await asaas.createSubscription({
        customerId,
        value,
        nextDueDate,
        billingType: "CREDIT_CARD",
        remoteIp,
        creditCard,
        creditCardHolderInfo
      });

      return { success: true, subscription };
    } catch (error: any) {
      console.error("[PAYMENT_CONTROLLER_ERROR]", error);
      set.status = 400;
      return { error: error.message };
    }
  }, {
    body: t.Object({
      customerId: t.String(),
      value: t.Number(),
      nextDueDate: t.String(),
      billingType: t.Optional(t.Union([t.Literal("CREDIT_CARD"), t.Literal("PIX")])),
      creditCard: t.Optional(t.Any()),
      creditCardHolderInfo: t.Optional(t.Any())
    })
  })
  .post("/link", async ({ body, request, set, user }) => {
    try {
      if (!user) {
        set.status = 401;
        return { error: "Não autorizado" };
      }

      const {
        customerEmail,
        customerName,
        customerCpfCnpj,
        businessId,
        planPrice,
        planName,
      } = body as any;

      const remoteIp = request.headers.get("x-client-ip") || 
                       request.headers.get("x-forwarded-for")?.split(',')[0]?.trim() || 
                       "127.0.0.1";

      console.log(`[PAYMENT_CONTROLLER] Gerando link para businessId: ${businessId}, Email: ${customerEmail}`);

      let resolvedCustomerCpfCnpj = String(customerCpfCnpj || "").replace(/\D/g, "");

      if (!resolvedCustomerCpfCnpj && (user as any).cpfCnpj) {
        resolvedCustomerCpfCnpj = String((user as any).cpfCnpj).replace(/\D/g, "");
      }

      const isValidCpfCnpj = resolvedCustomerCpfCnpj.length === 11 || resolvedCustomerCpfCnpj.length === 14;
      if (!isValidCpfCnpj) {
        set.status = 400;
        return { error: "CPF/CNPJ obrigatório para gerar pagamento. Atualize em Minha Conta." };
      }

      const asaasApiKey = process.env.ASAAS_API_KEY || process.env.ASAAS_ACCESS_TOKEN;
      const asaasApiUrl = (process.env.ASAAS_API_URL || process.env.ASAAS_BASE_URL || "https://api-sandbox.asaas.com/v3").replace(/\/+$/, "") + (process.env.ASAAS_API_URL?.endsWith("/v3") ? "" : "/v3");

      if (!asaasApiKey) {
        set.status = 500;
        return { error: "Erro de configuração do servidor" };
      }

      const customerSearchResponse = await fetch(`${asaasApiUrl}/customers?email=${customerEmail}`, {
        headers: { access_token: asaasApiKey },
      });
      const customerSearchResult = await customerSearchResponse.json() as any;

      let customerId = customerSearchResult.data?.[0]?.id;
      const existingCustomerCpfCnpj = String(customerSearchResult.data?.[0]?.cpfCnpj || "").replace(/\D/g, "");

      if (customerId && resolvedCustomerCpfCnpj && !existingCustomerCpfCnpj) {
        await fetch(`${asaasApiUrl}/customers/${customerId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            access_token: asaasApiKey,
            "x-forwarded-for": remoteIp,
          },
          body: JSON.stringify({
            name: customerName,
            email: customerEmail,
            cpfCnpj: resolvedCustomerCpfCnpj,
            externalReference: businessId,
            remoteIp,
          }),
        });
      }

      if (!customerId) {
        const createCustomerResponse = await fetch(`${asaasApiUrl}/customers`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            access_token: asaasApiKey,
            "x-forwarded-for": remoteIp,
          },
          body: JSON.stringify({
            name: customerName,
            email: customerEmail,
            cpfCnpj: resolvedCustomerCpfCnpj,
            externalReference: businessId,
            remoteIp,
          }),
        });
        const newCustomer = await createCustomerResponse.json() as any;
        if (newCustomer.errors) {
          throw new Error(newCustomer.errors[0].description);
        }
        customerId = newCustomer.id;
      }

      let subscriptionValue = planPrice || 49.9;
      subscriptionValue = Number(subscriptionValue);

      if (!Number.isFinite(subscriptionValue) || subscriptionValue <= 0) {
        set.status = 400;
        return { error: "Valor do plano inválido para gerar cobrança recorrente." };
      }

      const recurringPaymentLinkPayload = {
        name: planName ? `Assinatura ${planName} - ${customerName}` : `Assinatura Pro - ${customerName}`,
        description: planName ? `Assinatura recorrente (${planName}) - Aura Sistema` : "Assinatura recorrente Pro - Aura Sistema",
        billingType: "CREDIT_CARD",
        chargeType: "RECURRENT",
        period: "MONTHLY",
        subscriptionCycle: "MONTHLY",
        value: subscriptionValue,
        dueDateLimitDays: 1,
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        externalReference: businessId,
      };

      const paymentLinkResponse = await fetch(`${asaasApiUrl}/paymentLinks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          access_token: asaasApiKey,
          "x-forwarded-for": remoteIp,
        },
        body: JSON.stringify(recurringPaymentLinkPayload),
      });

      const paymentLinkData = await paymentLinkResponse.json() as any;
      const checkoutUrl = paymentLinkData?.url || paymentLinkData?.paymentLinkUrl || paymentLinkData?.shortUrl;

      if (!paymentLinkResponse.ok || !checkoutUrl) {
        throw new Error(paymentLinkData?.errors?.[0]?.description || "Falha ao gerar link de pagamento recorrente no Asaas");
      }

      return { url: checkoutUrl };
    } catch (error: any) {
      console.error("[PAYMENT_CONTROLLER_ERROR]", error);
      set.status = 500;
      return { error: error.message };
    }
  }, {
    body: t.Any()
  });
