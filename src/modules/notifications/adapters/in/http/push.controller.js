import { Elysia, t } from "elysia";
import { authPlugin } from "../../../../infrastructure/auth/auth-plugin";
import { repositoriesPlugin } from "../../../../infrastructure/di/repositories.plugin";
export const pushController = new Elysia({ prefix: "/push" })
    .use(authPlugin)
    .use(repositoriesPlugin)
    .onBeforeHandle(({ user, set }) => {
    if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
    }
})
    .post("/subscriptions", async ({ body, user, pushSubscriptionRepository, set }) => {
    try {
        const { endpoint, keys } = body;
        const p256dh = keys?.p256dh;
        const auth = keys?.auth;
        if (!endpoint || !p256dh || !auth) {
            set.status = 400;
            return { error: "Invalid subscription payload" };
        }
        const saved = await pushSubscriptionRepository.upsert(user.id, endpoint, p256dh, auth);
        return saved;
    }
    catch (error) {
        set.status = 500;
        return { error: error.message || "Internal Server Error" };
    }
}, {
    body: t.Object({
        endpoint: t.String(),
        keys: t.Object({
            p256dh: t.String(),
            auth: t.String()
        })
    })
});
