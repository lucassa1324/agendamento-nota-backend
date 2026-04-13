import { Elysia } from "elysia";
import { repositoriesPlugin } from "../../../../infrastructure/di/repositories.plugin";
import { authPlugin } from "../../../../infrastructure/auth/auth-plugin";
import { webpush } from "../../../application/webpush";

export const pushController = () => new Elysia({ prefix: "/push" })
  .use(repositoriesPlugin)
  .use(authPlugin)
  .onBeforeHandle(({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }
  })
  .post("/subscriptions", async ({ user, body, pushSubscriptionRepository }) => {
    console.log(`[PUSH_CONTROLLER] Recebido payload:`, JSON.stringify(body));

    let subscription: any = (body as any).subscription || body;

    if (!subscription || !subscription.endpoint) {
      console.error("[PUSH_CONTROLLER] Payload inválido - sem endpoint:", JSON.stringify(body));
      throw new Error("Invalid subscription object: missing endpoint");
    }

    if (!subscription.keys || !subscription.keys.p256dh || !subscription.keys.auth) {
      console.error("[PUSH_CONTROLLER] Payload inválido - sem chaves:", JSON.stringify(body));
      throw new Error("Invalid subscription object: missing keys");
    }

    console.log(`[PUSH_CONTROLLER] Registrando/Atualizando inscrição para user: ${user!.id}`);

    await pushSubscriptionRepository.upsert(
      user!.id,
      subscription.endpoint,
      subscription.keys.p256dh,
      subscription.keys.auth
    );

    const payload = JSON.stringify({
      title: "Notificações Ativadas",
      body: "Você receberá atualizações sobre seus agendamentos.",
      data: {
        url: '/',
        timestamp: Date.now()
      }
    });

    try {
      await webpush.sendNotification(subscription, payload);
      console.log("[PUSH_CONTROLLER] Notificação de boas-vindas enviada com sucesso.");
    } catch (error) {
      console.error("[PUSH_CONTROLLER] Erro ao enviar boas-vindas:", error);
    }

    return { success: true };
  })
  .get("/public-key", () => {
    const publicKey = process.env.VAPID_PUBLIC_KEY || "";
    console.log("[PUSH_CONTROLLER] Requested VAPID Public Key:", publicKey ? "FOUND" : "MISSING");
    return { publicKey };
  });
