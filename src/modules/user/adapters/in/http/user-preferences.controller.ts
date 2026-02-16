import { Elysia, t } from "elysia";
import { UserRepository } from "../../out/user.repository";
import { authPlugin } from "../../../../infrastructure/auth/auth-plugin";
import { repositoriesPlugin } from "../../../../infrastructure/di/repositories.plugin";

export const userPreferencesController = new Elysia({ prefix: "/user" })
  .use(repositoriesPlugin)
  .use(authPlugin)
  .onBeforeHandle(({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }
  })
  .get("/preferences", async ({ user, userRepository }) => {
    const userData = await userRepository.find(user!.id);
    if (!userData) {
      return { error: "User not found" };
    }
    
    return {
      notifyNewAppointments: userData.notifyNewAppointments,
      notifyCancellations: userData.notifyCancellations,
      notifyInventoryAlerts: userData.notifyInventoryAlerts
    };
  })
  .patch("/preferences", async ({ body, user, userRepository }) => {
    try {
      const updated = await userRepository.update(user!.id, {
        notifyNewAppointments: body.notify_new_appointments,
        notifyCancellations: body.notify_cancellations,
        notifyInventoryAlerts: body.notify_inventory_alerts
      });

      if (!updated || updated.length === 0) {
        return { error: "Failed to update preferences" };
      }

      return { success: true, preferences: updated[0] };
    } catch (error: any) {
      return { error: error.message };
    }
  }, {
    body: t.Object({
      notify_new_appointments: t.Optional(t.Boolean()),
      notify_cancellations: t.Optional(t.Boolean()),
      notify_inventory_alerts: t.Optional(t.Boolean())
    })
  });
