import { Elysia } from "elysia";
import { repositoriesPlugin } from "../../../../infrastructure/di/repositories.plugin";
import { authPlugin } from "../../../../infrastructure/auth/auth-plugin";
import { NotificationService } from "../../../application/notification.service";
import { webpush } from "../../../application/webpush";
export const notificationsController = () => new Elysia({ prefix: "/notifications" })
    .use(repositoriesPlugin)
    .use(authPlugin)
    .onBeforeHandle(({ user, set }) => {
    if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
    }
})
    .post("/test", async ({ user, pushSubscriptionRepository }) => {
    try {
        const notificationService = new NotificationService(pushSubscriptionRepository);
        const result = await notificationService.sendToUser(user.id, "Teste de Notificação", "Suas configurações estão funcionando!");
        return {
            success: true,
            message: `Notificações enviadas: ${result.sent}, Falhas: ${result.failed}`
        };
    }
    catch (error) {
        console.error("[NOTIFICATION_TEST_ERROR]", error);
        return { error: error.message };
    }
})
    .post("/subscribe", async ({ user, body, pushSubscriptionRepository }) => {
    const { subscription } = body;
    if (!subscription || !subscription.endpoint) {
        throw new Error("Invalid subscription object");
    }
    await pushSubscriptionRepository.upsert(user.id, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth);
    // Envia notificação de boas-vindas
    const payload = JSON.stringify({
        title: "Notificações Ativadas",
        body: "Você receberá atualizações sobre seus agendamentos.",
    });
    try {
        await webpush.sendNotification(subscription, payload);
    }
    catch (error) {
        console.error("[WELCOME_NOTIFICATION_ERROR]", error);
    }
    return { success: true };
});
