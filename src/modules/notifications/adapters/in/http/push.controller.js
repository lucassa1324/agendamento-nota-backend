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
    let subscription = body.subscription || body;
    if (body.endpoint && body.keys) {
        subscription = body;
    }
    if (!subscription || !subscription.endpoint) {
        console.error("[PUSH_CONTROLLER] Payload inválido recebido:", JSON.stringify(body));
        throw new Error("Invalid subscription object");
    }
    console.log(`[PUSH_CONTROLLER] Registrando nova inscrição para user: ${user.id}`);
    await pushSubscriptionRepository.upsert(user.id, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth);
    const payload = JSON.stringify({
        title: "Notificações Ativadas",
        body: "Você receberá atualizações sobre seus agendamentos.",
        icon: '/android-chrome-192x192.png',
        data: {
            url: '/',
            timestamp: Date.now()
        }
    });
    try {
        await webpush.sendNotification(subscription, payload);
        console.log("[PUSH_CONTROLLER] Notificação de boas-vindas enviada com sucesso.");
    }
    catch (error) {
        console.error("[PUSH_CONTROLLER] Erro ao enviar boas-vindas:", error);
    }
    return { success: true };
});
