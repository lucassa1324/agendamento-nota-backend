import { Elysia, t } from "elysia";
import { authPlugin } from "../auth/auth-plugin";
import { asaas } from "./asaas.client";

export const paymentController = () => new Elysia({ prefix: "/payment" })
  .use(authPlugin)
  .post("/subscribe", async ({ user, body, request, set }) => {
    try {
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const { customerId, value, nextDueDate, creditCard, creditCardHolderInfo } = body;
      
      // Captura o IP do cliente dos headers
      // O front-end deve enviar o IP do cliente no header 'x-client-ip' ou contar com 'x-forwarded-for'
      const remoteIp = request.headers.get("x-client-ip") || 
                       request.headers.get("x-forwarded-for")?.split(',')[0]?.trim() || 
                       "0.0.0.0";

      console.log(`[PAYMENT_CONTROLLER] Iniciando assinatura para user ${user.id} com IP: ${remoteIp}`);

      if (!remoteIp || remoteIp === "0.0.0.0") {
        console.warn("[PAYMENT_CONTROLLER] IP remoto não detectado ou inválido. O Asaas pode rejeitar transações de cartão.");
      }

      const subscription = await asaas.createSubscription({
        customerId,
        value,
        nextDueDate,
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
      creditCard: t.Optional(t.Any()),
      creditCardHolderInfo: t.Optional(t.Any())
    })
  });
