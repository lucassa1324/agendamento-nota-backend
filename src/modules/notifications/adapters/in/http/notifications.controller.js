import { Elysia } from "elysia";
import { repositoriesPlugin } from "../../../../infrastructure/di/repositories.plugin";
import { authPlugin } from "../../../../infrastructure/auth/auth-plugin";
import { NotificationService } from "../../../application/notification.service";
export const notificationsController = new Elysia({ prefix: "/notifications" })
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
        return { error: error.message };
    }
});
