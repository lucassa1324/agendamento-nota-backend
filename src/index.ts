// Forçar importação do @better-auth/telemetry para garantir que esteja disponível no bundle
try {
  require("@better-auth/telemetry");
  console.log("[STARTUP] @better-auth/telemetry carregado com sucesso");
} catch (e) {
  const errorMessage = e instanceof Error ? e.message : String(e);
  console.warn("[STARTUP] @better-auth/telemetry não encontrado, continuando sem telemetria:", errorMessage);
}

console.log("[STARTUP] Preparando handler para Vercel (Bun)");

const createApp = () => {
  try {
    console.log("[STARTUP] Carregando módulos...");

    const { Elysia } = require("elysia");
    const { auth } = require("./modules/infrastructure/auth/auth");
    const { authPlugin } = require("./modules/infrastructure/auth/auth-plugin");
    const { repositoriesPlugin } = require("./modules/infrastructure/di/repositories.plugin");

    // Controllers
    const { userController } = require("./modules/user/adapters/in/http/user.controller");
    const { businessController } = require("./modules/business/adapters/in/http/business.controller");
    const { serviceController } = require("./modules/services/adapters/in/http/service.controller");
    const { reportController } = require("./modules/reports/adapters/in/http/report.controller");
    const { appointmentController } = require("./modules/appointments/adapters/in/http/appointment.controller");
    const { staffController } = require("./modules/staff/adapters/in/http/staff.controller");
    const { settingsController } = require("./modules/settings/adapters/in/http/settings.controller");
    const { inventoryController } = require("./modules/inventory/adapters/in/http/inventory.controller");
    const { expenseController } = require("./modules/expenses/adapters/in/http/expense.controller");
    const { masterAdminController } = require("./modules/business/adapters/in/http/master-admin.controller");
    const { galleryController } = require("./modules/gallery/adapters/in/http/gallery.controller");
    const { storageController } = require("./modules/infrastructure/storage/storage.controller");
    const { notificationsController } = require("./modules/notifications/adapters/in/http/notifications.controller");
    const { pushController } = require("./modules/notifications/adapters/in/http/push.controller");
    const { userPreferencesController } = require("./modules/user/adapters/in/http/user-preferences.controller");
    const { paymentController } = require("./modules/infrastructure/payment/payment.controller");
    const { asaasWebhookController } = require("./modules/infrastructure/payment/asaas.webhook.controller");
    const { billingController } = require("./modules/billing/adapters/in/http/billing.controller");
    const { dnsController } = require("./modules/dns/infrastructure/adapters/in/http/dns.controller");

    console.log("[STARTUP] Módulos carregados. Criando instância do Elysia...");

    const app = new Elysia({
      name: 'AgendamentoNota',
      prefix: "/api"
    })
      .use(authPlugin)
      .use(repositoriesPlugin)
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
      }));

    return app;
  } catch (error) {
    console.error("[FATAL] Erro ao criar app:", error);
    throw error;
  }
};

const app = createApp();

module.exports = app;
