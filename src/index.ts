console.log("[STARTUP] Inicializando Back-end com Try-Catch Global");

// Validação CRÍTICA de variáveis de ambiente antes de qualquer coisa
if (!process.env.DATABASE_URL) {
  console.error("FATAL: DATABASE_URL IS MISSING");
  throw new Error("DATABASE_URL IS MISSING");
}

if (!process.env.BETTER_AUTH_SECRET) {
  console.warn("WARNING: BETTER_AUTH_SECRET IS MISSING");
}

import { Elysia, t } from "elysia";

// Definição da App Wrapper para capturar erros de importação/inicialização
const startServer = () => {
  try {
    console.log("[STARTUP] Carregando módulos...");

    // Imports dentro do try-catch para capturar erros de linkagem/dependência circular
    const { auth } = require("./modules/infrastructure/auth/auth");
    const { authPlugin } = require("./modules/infrastructure/auth/auth-plugin");
    const { repositoriesPlugin } = require("./modules/infrastructure/di/repositories.plugin");
    const { db } = require("./modules/infrastructure/drizzle/database");
    const schema = require("./db/schema");
    const { asaas } = require("./modules/infrastructure/payment/asaas.client");
    const { eq } = require("drizzle-orm");

    // Controllers
    const { UserController } = require("./modules/user/adapters/in/http/user.controller");
    const { ListUsersUseCase } = require("./modules/user/application/use-cases/list-users.use-case");
    const { CreateUserUseCase } = require("./modules/user/application/use-cases/create-user.use-case");
    const { UserRepository } = require("./modules/user/adapters/out/user.repository");

    const { businessController } = require("./modules/business/adapters/in/http/business.controller");
    const { serviceController } = require("./modules/services/adapters/in/http/service.controller");
    const { reportController } = require("./modules/reports/adapters/in/http/report.controller");
    const { appointmentController } = require("./modules/appointments/adapters/in/http/appointment.controller");
    // Tratamento especial para settingsController que teve problemas de export default/named
    const settingsModule = require("./modules/settings/adapters/in/http/settings.controller");
    const settingsController = settingsModule.default || settingsModule.settingsController;

    const { inventoryController } = require("./modules/inventory/adapters/in/http/inventory.controller");
    const { expenseController } = require("./modules/expenses/adapters/in/http/expense.controller");
    const { masterAdminController } = require("./modules/business/adapters/in/http/master-admin.controller");
    const { galleryController } = require("./modules/gallery/adapters/in/http/gallery.controller");
    const { storageController } = require("./modules/infrastructure/storage/storage.controller");
    const { notificationsController } = require("./modules/notifications/adapters/in/http/notifications.controller");
    const { pushController } = require("./modules/notifications/adapters/in/http/push.controller");
    const { userPreferencesController } = require("./modules/user/adapters/in/http/user-preferences.controller");

    console.log("[STARTUP] Módulos carregados. Instanciando dependências...");

    // Instanciação de Dependências Globais
    const userRepository = new UserRepository();
    const createUserUseCase = new CreateUserUseCase(userRepository);
    const listUsersUseCase = new ListUsersUseCase(userRepository);
    const userController = new UserController(createUserUseCase, listUsersUseCase);

    console.log("[STARTUP] Criando instância do Elysia...");

    const app = new Elysia()
      .onRequest(({ request, set }) => {
        // Log para debug de CORS
        if (request.method === "OPTIONS") {
          console.log(`[CORS_PREFLIGHT] Origin: ${request.headers.get("origin")} | Method: ${request.headers.get("access-control-request-method")}`);
        }

        const origin = request.headers.get("origin");

        const allowedOrigins = [
          'http://localhost:3000',
          'http://127.0.0.1:3000',
          'https://agendamento-nota-front.vercel.app',
          'https://landingpage-agendamento-front.vercel.app'
        ];

        const isAllowed = allowedOrigins.includes(origin!) ||
          (origin && origin.match(/http:\/\/.*\.localhost:\d+$/)) ||
          (origin && origin.match(/\.vercel\.app$/));

        if (isAllowed && origin) {
          set.headers["Access-Control-Allow-Origin"] = origin;
          set.headers["Access-Control-Allow-Credentials"] = "true";
          set.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH";
          set.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, Cookie, X-Requested-With, Cache-Control";
          set.headers["Access-Control-Expose-Headers"] = "Set-Cookie, set-cookie, Authorization, Cache-Control";

          if (request.method === "OPTIONS") {
            return new Response(null, {
              status: 204,
              headers: {
                "Access-Control-Allow-Origin": origin,
                "Access-Control-Allow-Credentials": "true",
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
                "Access-Control-Allow-Headers": "Content-Type, Authorization, Cookie, X-Requested-With, Cache-Control",
                "Access-Control-Max-Age": "86400",
              }
            });
          }
        }
      })

      .onRequest(({ set }) => {
        set.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, proxy-revalidate";
        set.headers["Pragma"] = "no-cache";
        set.headers["Expires"] = "0";
      })
      .mount(auth.handler)
      .group("/api/auth", (app) =>
        app
          .onRequest(({ request, set }) => {
            // Força headers CORS específicos para rotas de auth,
            // pois o Better Auth pode sobrescrever ou ser muito restrito
            const origin = request.headers.get("origin");
            if (origin) {
              set.headers["Access-Control-Allow-Origin"] = origin;
              set.headers["Access-Control-Allow-Credentials"] = "true";
              set.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS";
              set.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, Cookie, X-Requested-With";
              set.headers["Access-Control-Expose-Headers"] = "Set-Cookie, set-cookie";
            }
            if (request.method === "OPTIONS") {
              return new Response(null, { status: 204 });
            }
          })
          .mount(auth.handler)
      )
      .get("/get-session", async ({ request }) => {
        try {
          const session = await auth.api.getSession({
            headers: request.headers,
          });
          return session || { session: null, user: null };
        } catch (error) {
          console.error("[GET-SESSION] ERRO FATAL:", error);
          return { session: null, user: null };
        }
      })
      .use(authPlugin)
      .use(userController.registerRoutes())
      .group("/api", (api) =>
        api
          .group("/account", (account) =>
            account
              .use(repositoriesPlugin)
              .onBeforeHandle(({ user, set }) => {
                if (!user) {
                  set.status = 401;
                  return { error: "Unauthorized" };
                }
              })
              .post("/cancel-feedback", async ({ user, body, set }) => {
                const { reason, details, customReason } = body as {
                  reason: string;
                  details?: string;
                  customReason?: string;
                };

                if (!reason) {
                  set.status = 422;
                  return { error: "Missing reason" };
                }

                await db.insert(schema.accountCancellationFeedback).values({
                  id: crypto.randomUUID(),
                  userId: user!.id,
                  reason,
                  details: customReason || details || null,
                  createdAt: new Date()
                });

                return { success: true };
              }, {
                body: t.Object({
                  reason: t.String(),
                  details: t.Optional(t.String()),
                  customReason: t.Optional(t.String())
                })
              })
              .get("/cancellation-offer", async ({ user }) => {
                const [currentUser] = await db
                  .select({ lastRetentionDiscountAt: schema.user.lastRetentionDiscountAt })
                  .from(schema.user)
                  .where(eq(schema.user.id, user!.id))
                  .limit(1);

                const last = currentUser?.lastRetentionDiscountAt
                  ? new Date(currentUser.lastRetentionDiscountAt)
                  : null;

                const now = new Date();
                let available = true;
                let nextEligibleAt: Date | null = null;

                if (last) {
                  const nextEligible = new Date(last);
                  nextEligible.setMonth(nextEligible.getMonth() + 12);
                  if (nextEligible > now) {
                    available = false;
                    nextEligibleAt = nextEligible;
                  }
                }

                if (!available) {
                  return { available: false, nextEligibleAt };
                }

                return {
                  available: true,
                  offer: {
                    type: "RETENTION_20_3M",
                    percentage: 20,
                    durationMonths: 3
                  }
                };
              })
              .post("/accept-offer", async ({ user, body }) => {
                const { subscriptionId } = body as { subscriptionId?: string };

                // 1. Registra que o usuário aceitou a oferta no banco
                await db.update(schema.user)
                  .set({
                    lastRetentionDiscountAt: new Date(),
                    // Opcional: você pode querer resetar o status se ele estava "PENDING_CANCELLATION"
                    accountStatus: "ACTIVE",
                    cancellationRequestedAt: null,
                    retentionEndsAt: null
                  })
                  .where(eq(schema.user.id, user!.id));

                // 2. Aplica o desconto no gateway de pagamento
                if (subscriptionId) {
                  await asaas.applyDiscount(subscriptionId, {
                    percentage: 20,
                    cycles: 3
                  });
                }

                return {
                  success: true,
                  message: "Desconto aplicado com sucesso! Obrigado por continuar conosco."
                };
              }, {
                body: t.Object({
                  subscriptionId: t.Optional(t.String())
                })
              })
              .post("/terminate", async ({ user, body }) => {
                const { subscriptionId } = body as { subscriptionId?: string };

                if (subscriptionId) {
                  await asaas.cancelSubscription(subscriptionId);
                }

                const now = new Date();
                const retentionEndsAt = new Date(now);
                retentionEndsAt.setDate(retentionEndsAt.getDate() + 365);

                await db.update(schema.user)
                  .set({
                    accountStatus: "PENDING_CANCELLATION",
                    active: false,
                    cancellationRequestedAt: now,
                    retentionEndsAt
                  })
                  .where(eq(schema.user.id, user!.id));

                return {
                  success: true,
                  status: "PENDING_CANCELLATION",
                  retentionEndsAt
                };
              }, {
                body: t.Object({
                  subscriptionId: t.Optional(t.String())
                })
              })
          )
          .use(businessController())
          .use(serviceController())
          .use(reportController())
          .use(appointmentController())
          .use(settingsController ? settingsController() : (app: any) => app) // Fallback seguro se settingsController falhar
          .use(inventoryController())
          .use(expenseController())
          .use(masterAdminController())
          .use(galleryController())
          .use(storageController())
          .use(notificationsController())
          .use(pushController())
          .use(userPreferencesController())
      )
      .get("/", () => {
        const urlHint = process.env.BETTER_AUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
        return `🦊 Elysia está rodando em ${urlHint}`;
      })
      .get("/api/health", () => ({ status: "ok", timestamp: new Date().toISOString(), version: "V2-TRY-CATCH" }))
      .onError(({ code, error }) => {
        console.error(`\n[ERROR] ${code}:`, error);
      });

    console.log("[STARTUP] Servidor configurado com sucesso.");
    const urlHint = process.env.BETTER_AUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
    console.log(`🦊 Elysia está rodando em ${urlHint}`);
    return app;

  } catch (error) {
    console.error("ERRO DE STARTUP (CRÍTICO):", error);
    // Retorna uma instância mínima de erro para não derrubar o processo sem logs
    return new Elysia().get("/*", () => {
      return { error: "STARTUP_FAILED", details: String(error) };
    });
  }
};

// Exporta a aplicação inicializada
export default startServer();
