// local.ts - Servidor local simples
import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";

// Forçar importação do @better-auth/telemetry para garantir que esteja disponível
try {
  require("@better-auth/telemetry");
  console.log("[STARTUP] @better-auth/telemetry carregado com sucesso");
} catch (e) {
  const errorMessage = e instanceof Error ? e.message : String(e);
  console.warn("[STARTUP] @better-auth/telemetry não encontrado, continuando sem telemetria:", errorMessage);
}

import { auth } from "./modules/infrastructure/auth/auth";
import { authPlugin } from "./modules/infrastructure/auth/auth-plugin";
import { repositoriesPlugin } from "./modules/infrastructure/di/repositories.plugin";
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

const port = 3001;

console.log(`\n>>> [LOCAL] Iniciando servidor na porta ${port}...`);
console.log(`>>> [LOCAL] Frontend URL esperada: ${process.env.FRONTEND_URL || "http://localhost:3000"}`);

const app = new Elysia({ prefix: "/api" })
  .use(cors({
    origin: "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }))
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
  .use(asaasWebhookController) // É uma instância, não usar parênteses
  .use(billingController())
  .use(dnsController())
  .all("/auth/*", async (context: any) => {
    const { request, path, set } = context;
    console.log(`>>> [AUTH_HANDLER] ${request.method} ${path}`);

    try {
      const response = await auth.handler(request);
      console.log(`<<< [AUTH_HANDLER] Status: ${response.status}`);
      return response;
    } catch (error: any) {
      console.error(`<<< [AUTH_HANDLER_ERROR]`, error);
      set.status = 500;
      return { error: "Auth handler error", message: error?.message || "Unknown error" };
    }
  })
  .get("/health", () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
  }));

app.listen(port, () => {
  console.log(`\n🦊 Elysia está rodando em http://localhost:${port}`);
  console.log(`🚀 Diagnósticos em http://localhost:${port}/diagnostics/headers`);

  // Log de rotas registradas para debug
  console.log("\n📋 Rotas registradas:");
  app.routes.forEach(r => {
    console.log(`  ${r.method} ${r.path}`);
  });
});
