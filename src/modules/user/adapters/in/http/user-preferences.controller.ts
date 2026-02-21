import { Elysia, t } from "elysia";
import { authPlugin } from "../../../../infrastructure/auth/auth-plugin";
import { repositoriesPlugin } from "../../../../infrastructure/di/repositories.plugin";

export const userPreferencesController = () => new Elysia({ prefix: "/user" })
  .use(repositoriesPlugin)
  .use(authPlugin)
  .onBeforeHandle(({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }
  })
  .get("/preferences", async ({ user, userRepository }) => {
    const currentUser = await userRepository.find(user!.id);
    if (!currentUser) {
      throw new Error("User not found");
    }

    return {
      notifications: {
        newAppointments: currentUser.notifyNewAppointments,
        cancellations: currentUser.notifyCancellations,
        inventoryAlerts: currentUser.notifyInventoryAlerts
      },
      theme: "light"
    };
  })
  .patch("/preferences", async ({ user, body, userRepository }) => {
    const { notifications } = body as any;

    if (notifications) {
      await userRepository.update(user!.id, {
        notifyNewAppointments: notifications.newAppointments,
        notifyCancellations: notifications.cancellations,
        notifyInventoryAlerts: notifications.inventoryAlerts
      });
    }

    return { success: true };
  }, {
    body: t.Object({
        notifications: t.Optional(t.Object({
            newAppointments: t.Optional(t.Boolean()),
            cancellations: t.Optional(t.Boolean()),
            inventoryAlerts: t.Optional(t.Boolean())
        })),
        theme: t.Optional(t.String())
    })
  });
