import { Elysia } from "elysia";
import { auth } from "./modules/infrastructure/auth/auth";
import { authPlugin } from "./modules/infrastructure/auth/auth-plugin";
import { createRepositoriesPlugin } from "./modules/infrastructure/di/repositories.plugin";

// Controllers
import { userController } from "./modules/user/adapters/in/http/user.controller";
import { businessController } from "./modules/business/adapters/in/http/business.controller";
import { serviceController } from "./modules/services/adapters/in/http/service.controller";
import { reportController } from "./modules/reports/adapters/in/http/report.controller";
import { appointmentController } from "./modules/appointments/adapters/in/http/appointment.controller";
import { staffController } from "./modules/staff/adapters/in/http/staff.controller";
import { settingsController } from "./modules/settings/adapters/in/http/settings.controller";
import { inventoryController } from "./modules/inventory/adapters/in/http/inventory.controller";
import { expenseController } from "./modules/expenses/adapters/in/http/expense.controller";
import { masterAdminController } from "./modules/business/adapters/in/http/master-admin.controller";
import { galleryController } from "./modules/gallery/adapters/in/http/gallery.controller";
import { storageController } from "./modules/infrastructure/storage/storage.controller";
import { notificationsController } from "./modules/notifications/adapters/in/http/notifications.controller";
import { pushController } from "./modules/notifications/adapters/in/http/push.controller";
import { userPreferencesController } from "./modules/user/adapters/in/http/user-preferences.controller";
import { paymentController } from "./modules/infrastructure/payment/payment.controller";
import { asaasWebhookController } from "./modules/infrastructure/payment/asaas.webhook.controller";
import { billingController } from "./modules/billing/adapters/in/http/billing.controller";
import { dnsController } from "./modules/dns/infrastructure/adapters/in/http/dns.controller";

let appInstance: Elysia<any, any, any, any, any, any, any> | null = null;

function createElysiaApp() {
  console.log("[STARTUP] Preparando app Elysia (src/index.ts)");

  const app = new Elysia({ name: 'AgendamentoNota' });

  return app
    .group("/api", (api) =>
      api
        .use(authPlugin)
        .use(createRepositoriesPlugin()) // Lazy initialization do plugin de repositórios
        .use(userController())
        .use(businessController())
        .use(serviceController())
        .use(reportController())
        .use(appointmentController())
        .use(staffController())
        .use(settingsController())
        .use(inventoryController())
        .use(expenseController())
        .use(masterAdminController())
        .use(galleryController())
        .use(storageController())
        .use(notificationsController())
        .use(pushController())
        .use(userPreferencesController())
        .use(paymentController())
        .use(asaasWebhookController)
        .use(billingController())
        .use(dnsController())
        .all("/auth/*", async (ctx) => {
          console.log(`>>> [AUTH_HANDLER] ${ctx.request.method} ${ctx.path}`);
          try {
            const response = await auth.handler(ctx.request);
            console.log(`<<< [AUTH_HANDLER] Status: ${response.status}`);
            return response;
          } catch (error: any) {
            console.error(`<<< [AUTH_HANDLER_ERROR]`, error);
            return new Response(
              JSON.stringify({ error: "Auth handler error", message: error?.message || "Unknown error" }),
              { status: 500, headers: { "Content-Type": "application/json" } }
            );
          }
        })
        .get("/health", () => ({
          status: "ok",
          timestamp: new Date().toISOString(),
        }))
    );
}

export function createApp(): Elysia<any, any, any, any, any, any, any> {
  if (appInstance) {
    return appInstance;
  }

  appInstance = createElysiaApp();

  if (process.env.NODE_ENV !== "production") {
    appInstance.listen(3001);
    console.log(`🦊 Elysia está rodando em http://localhost:3001`);
  }

  return appInstance!;
}

const app = createApp();
export default app.handle;
