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
import { DNSController } from './modules/dns/infrastructure/adapters/in/http/dns.controller'

// Definição da App Wrapper para capturar erros de importação/inicialização
const startServer = () => {
  try {
    console.log("[STARTUP] Carregando módulos...");

    // Imports dentro do try-catch para capturar erros de linkagem/dependência circular
    const { auth, detectHashAlgorithm, verifyScryptPassword } = require("./modules/infrastructure/auth/auth");
    const { authPlugin } = require("./modules/infrastructure/auth/auth-plugin");
    const { repositoriesPlugin } = require("./modules/infrastructure/di/repositories.plugin");
    const { db } = require("./modules/infrastructure/drizzle/database");
    const schema = require("./db/schema");
    const { asaas } = require("./modules/infrastructure/payment/asaas.client");
    const { uploadToB2 } = require("./modules/infrastructure/storage/b2.storage");
    const { eq, and, count, ilike } = require("drizzle-orm");

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
    const { paymentController } = require("./modules/infrastructure/payment/payment.controller");
    const { asaasWebhookController } = require("./modules/infrastructure/payment/asaas.webhook.controller");
    const { billingController } = require("./modules/billing/adapters/in/http/billing.controller");

    console.log("[STARTUP] Módulos carregados. Instanciando dependências...");

    // Instanciação de Dependências Globais
    const userRepository = new UserRepository();
    const createUserUseCase = new CreateUserUseCase(userRepository);
    const listUsersUseCase = new ListUsersUseCase(userRepository);
    const userController = new UserController(createUserUseCase, listUsersUseCase);

    console.log("[STARTUP] Criando instância do Elysia...");

    const app = new Elysia({
      name: 'AgendamentoNota'
    })
      .get("/email-verified", async ({ query }) => {
        const { token } = query;
        const frontendUrl = process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

        if (!token) {
          console.log("[VERIFY_EMAIL] Chamado sem token, assumindo que veio de um redirecionamento de sucesso.");
          return Response.redirect(`${frontendUrl}/admin?verified=true`, 302);
        }

        try {
          console.log(`[VERIFY_EMAIL] Iniciando verificação para token: ${token}`);
          await auth.api.verifyEmail({
            query: {
              token
            }
          });

          console.log(`[VERIFY_EMAIL] Sucesso! Redirecionando para o login.`);
          return Response.redirect(`${frontendUrl}/admin?verified=true`, 302);
        } catch (e) {
          console.error("[VERIFY_EMAIL_ERROR]", e);
          return Response.redirect(`${frontendUrl}/admin?error=verification_failed`, 302);
        }
      })
      .all("/api/auth/*", async (ctx) => {
        console.log(`>>> [AUTH_HANDLER_START] ${ctx.request.method} ${ctx.path}`);
        try {
          // Log do body se for POST para ajudar no debug do erro 400
          if (ctx.request.method === "POST") {
            try {
              const clonedRequest = ctx.request.clone();
              const bodyText = await clonedRequest.text();
              console.log(`>>> [AUTH_BODY] ${bodyText}`);
            } catch (e) {
              console.warn(">>> [AUTH_BODY_ERROR] Não foi possível ler o corpo da requisição");
            }
          }

          // Passamos a requisição original. O Better Auth sabe lidar com ela.
          const response = await auth.handler(ctx.request);

          console.log(`<<< [AUTH_HANDLER_END] Status: ${response.status}`);

          if (response.status >= 400) {
            try {
              const clonedRes = response.clone();
              const errorText = await clonedRes.text();
              console.error(`<<< [AUTH_ERROR_DETAILS] ${errorText}`);
            } catch (e) {
              console.error("<<< [AUTH_ERROR_DETAILS_FAILED] Erro ao ler corpo do erro");
            }
          }

          // Se não houver resposta do Better Auth, retornamos erro 500
          if (!response) {
            return new Response(JSON.stringify({ error: "Internal Auth Error" }), {
              status: 500,
              headers: { "Content-Type": "application/json" }
            });
          }

          // Pegamos o corpo da resposta. Se for nulo, usamos um JSON vazio.
          const responseBody = response.body ? response.body : JSON.stringify({});

          // Criamos a nova resposta
          const newResponse = new Response(responseBody, {
            status: response.status,
            statusText: response.statusText,
            headers: new Headers(response.headers)
          });

          // Adicionar headers de CORS manualmente para o bypass do front funcionar
          const origin = ctx.request.headers.get("origin");
          if (origin) {
            newResponse.headers.set("Access-Control-Allow-Origin", origin);
            newResponse.headers.set("Access-Control-Allow-Credentials", "true");
            newResponse.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
            newResponse.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, Cookie, X-Requested-With, Cache-Control");
          }

          // Se for logout, limpamos o cookie explicitamente para o front-end
          if (ctx.path.endsWith("/sign-out") || ctx.path.endsWith("/logout")) {
            console.log("[LOGOUT] Limpando cookie better-auth.session_token");
            newResponse.headers.set("Set-Cookie", "better-auth.session_token=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax");
          }

          return newResponse;
        } catch (e: any) {
          console.error(`!!! [AUTH_HANDLER_ERROR] ${e.message}`, e.stack);
          throw e;
        }
      })
      .onRequest(({ request, set }) => {
        // Log simplificado apenas para ver a rota sendo chamada
        const url = new URL(request.url);
        if (!url.pathname.includes("/api/auth/session")) { // Opcional: silenciar logs de sessão frequentes
          console.log(`>>> [RECEIVE] ${request.method} ${url.pathname}`);
        }

        if (request.method === "OPTIONS") {
          const origin = request.headers.get("origin");
          const allowedOrigins = [
            'http://localhost:3000',
            'http://localhost:3001',
            'http://localhost:3002',
            'http://127.0.0.1:3000',
            'https://app.aurasistema.com.br',
            'https://aurasistema.com.br'
          ];

          const isAllowed = allowedOrigins.includes(origin!) ||
            (origin && origin.match(/http:\/\/.*\.localhost:\d+$/)) ||
            (origin && (origin.endsWith('.aurasistema.com.br') || origin === 'https://aurasistema.com.br')) ||
            (origin && origin.endsWith('.vercel.app'));

          if (isAllowed && origin) {
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
      .onBeforeHandle(({ request, set }) => {
        const origin = request.headers.get("origin");
        const allowedOrigins = [
          'http://localhost:3000',
          'http://localhost:3001',
          'http://localhost:3002',
          'http://127.0.0.1:3000',
          'https://app.aurasistema.com.br',
          'https://aurasistema.com.br'
        ];

        const isAllowed = allowedOrigins.includes(origin!) ||
          (origin && origin.match(/http:\/\/.*\.localhost:\d+$/)) ||
          (origin && (origin.endsWith('.aurasistema.com.br') || origin === 'https://aurasistema.com.br')) ||
          (origin && origin.endsWith('.vercel.app'));

        if (isAllowed && origin) {
          set.headers["Access-Control-Allow-Origin"] = origin;
          set.headers["Access-Control-Allow-Credentials"] = "true";
          set.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH",
          set.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, Cookie, X-Requested-With, Cache-Control";
          set.headers["Access-Control-Expose-Headers"] = "Set-Cookie, set-cookie, Authorization, Cache-Control";
        }

        set.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, proxy-revalidate";
        set.headers["Pragma"] = "no-cache";
        set.headers["Expires"] = "0";
      })
      .use(authPlugin)
      .use(repositoriesPlugin)
      .use(userController.registerRoutes())
      .group("/api", (api) =>
        api
          .post("/feedback", async ({ body, user, set, request }) => {
            try {
              const payload = body as {
                type?: "bug" | "suggestion";
                description?: string;
                screenshot?: string;
                url?: string;
                userAgent?: string;
                metadata?: Record<string, unknown>;
              };

              const feedbackType =
                payload?.type?.toLowerCase() === "suggestion"
                  ? "SUGGESTION"
                  : "BUG";

              if (!payload?.description?.trim()) {
                set.status = 400;
                return { error: "Descrição é obrigatória." };
              }

              if (feedbackType === "BUG" && !payload?.screenshot) {
                set.status = 400;
                return { error: "Screenshot é obrigatória para relato de bug." };
              }

              let screenshotUrl: string | null = null;

              const pageUrl = payload.url || "";
              let companyId: string | null = null;

              if (pageUrl) {
                try {
                  const parsedUrl = new URL(pageUrl);
                  const segments = parsedUrl.pathname
                    .split("/")
                    .map((segment) => segment.trim())
                    .filter(Boolean);
                  const blockedSlugs = new Set([
                    "admin",
                    "api",
                    "dashboard",
                    "master",
                  ]);
                  const maybeSlug = segments.find(
                    (segment) => !blockedSlugs.has(segment.toLowerCase()),
                  );

                  if (maybeSlug) {
                    const [company] = await db
                      .select({ id: schema.companies.id })
                      .from(schema.companies)
                      .where(eq(schema.companies.slug, maybeSlug.toLowerCase()))
                      .limit(1);
                    companyId = company?.id || null;
                  }
                } catch { }
              }

              if (payload.screenshot) {
                const matches = payload.screenshot.match(
                  /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/,
                );

                if (!matches || !matches[1] || !matches[2]) {
                  set.status = 400;
                  return { error: "Formato de screenshot inválido." };
                }

                const contentType = matches[1];
                const base64Data = matches[2];
                const extensionMap: Record<string, string> = {
                  "image/png": "png",
                  "image/jpeg": "jpg",
                  "image/jpg": "jpg",
                  "image/webp": "webp",
                };
                const extension = extensionMap[contentType] || "png";
                const screenshotBuffer = Buffer.from(base64Data, "base64");
                const key = `feedback/${feedbackType.toLowerCase()}/${companyId || "unknown"}/${crypto.randomUUID()}.${extension}`;
                screenshotUrl = await uploadToB2({
                  buffer: screenshotBuffer,
                  contentType,
                  key,
                  cacheControl: "public, max-age=31536000",
                });
              }

              const forwardedFor = request.headers.get("x-forwarded-for");
              const realIp = request.headers.get("x-real-ip");
              const ipAddress = forwardedFor?.split(",")[0]?.trim() || realIp || null;
              const acceptLanguage = request.headers.get("accept-language");
              const clientMetadata =
                payload.metadata && typeof payload.metadata === "object"
                  ? payload.metadata
                  : {};
              const metadata = {
                ...clientMetadata,
                requestHost: request.headers.get("host"),
                requestOrigin: request.headers.get("origin"),
                requestReferer: request.headers.get("referer"),
                secChUa: request.headers.get("sec-ch-ua"),
                secChUaMobile: request.headers.get("sec-ch-ua-mobile"),
                secChUaPlatform: request.headers.get("sec-ch-ua-platform"),
                submittedAtServer: new Date().toISOString(),
              };

              const [created] = await db
                .insert(schema.bugReports)
                .values({
                  id: crypto.randomUUID(),
                  reporterUserId: user?.id || null,
                  companyId,
                  type: feedbackType,
                  description: payload.description.trim(),
                  screenshotUrl,
                  pageUrl: pageUrl || "",
                  userAgent: payload.userAgent || null,
                  ipAddress,
                  acceptLanguage,
                  metadata,
                  status: "NEW",
                  createdAt: new Date(),
                  updatedAt: new Date(),
                })
                .returning({ id: schema.bugReports.id });

              return {
                success: true,
                id: created?.id,
                type: feedbackType,
                screenshotUrl,
              };
            } catch (error: any) {
              console.error("[BUG_REPORT_CREATE_ERROR]:", error);
              set.status = 500;
              return {
                error: "Falha ao registrar feedback.",
                message: error?.message || "Erro interno.",
              };
            }
          }, {
            body: t.Object({
              type: t.Union([t.Literal("bug"), t.Literal("suggestion")]),
              description: t.String(),
              screenshot: t.Optional(t.String()),
              url: t.Optional(t.String()),
              userAgent: t.Optional(t.String()),
              metadata: t.Optional(t.Any()),
            }),
          })
          .group("/account", (account) =>
            account
              .onBeforeHandle(({ user, set }) => {
                if (!user) {
                  set.status = 401;
                  return { error: "Unauthorized" };
                }
              })
              .patch("/complete-onboarding", async ({ user }) => {
                await db.update(schema.user)
                  .set({ hasCompletedOnboarding: true })
                  .where(eq(schema.user.id, user!.id));

                return { success: true };
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
            .get("/system-announcement", async () => {
              try {
                const [announcement] = await db
                  .select()
                  .from(schema.systemSettings)
                  .where(eq(schema.systemSettings.key, "global_announcement"))
                  .limit(1);

                return {
                  message: announcement?.value || null,
                  updatedAt: announcement?.updatedAt || null
                };
              } catch (error) {
                return { message: null };
              }
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

                const [currentUser] = await db
                  .select({
                    createdAt: schema.user.createdAt,
                  })
                  .from(schema.user)
                  .where(eq(schema.user.id, user!.id))
                  .limit(1);

                const now = new Date();
                const accountCreatedAt = currentUser?.createdAt
                  ? new Date(currentUser.createdAt)
                  : now;
                const diffInMs = now.getTime() - accountCreatedAt.getTime();
                const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
                const eligibleFullRefund = diffInDays <= 7;
                const refundPolicyMessage = eligibleFullRefund
                  ? "Cancelamento dentro de 7 dias: elegível a reembolso total."
                  : "Cancelamento após 7 dias: não há reembolso parcial ou total.";

                if (subscriptionId) {
                  await asaas.cancelSubscription(subscriptionId);

                  // Se for elegível para reembolso total (7 dias), tenta estornar o último pagamento
                  if (eligibleFullRefund) {
                    try {
                      console.log(`[TERMINATE] Usuário ${user!.id} elegível para reembolso total. Buscando pagamentos da assinatura ${subscriptionId}...`);
                      const payments = await asaas.listSubscriptionPayments(subscriptionId);

                      // Filtra pagamentos confirmados ou recebidos
                      const refundablePayments = payments.filter((p: any) =>
                        p.status === "CONFIRMED" || p.status === "RECEIVED"
                      );

                      if (refundablePayments.length > 0) {
                        // Ordena por data e pega o mais recente (geralmente o único em 7 dias)
                        const latestPayment = refundablePayments.sort((a: any, b: any) =>
                          new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()
                        )[0];

                        console.log(`[TERMINATE] Iniciando estorno do pagamento ${latestPayment.id} para usuário ${user!.id}`);
                        await asaas.refundPayment(latestPayment.id);
                      } else {
                        console.warn(`[TERMINATE] Nenhum pagamento confirmando encontrado para reembolso da assinatura ${subscriptionId}`);
                      }
                    } catch (refundError) {
                      console.error("[TERMINATE_REFUND_ERROR] Erro ao processar estorno automático:", refundError);
                      // Não travamos o cancelamento se o estorno falhar, mas logamos
                    }
                  }
                }

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
                  retentionEndsAt,
                  refundPolicy: {
                    eligibleFullRefund,
                    daysSinceAccountCreation: diffInDays,
                    message: refundPolicyMessage,
                  },
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
          .use(paymentController())
          .use(asaasWebhookController)
          .use(billingController())
          .use(DNSController())
      )
      .get("/", () => {
        const urlHint = process.env.BETTER_AUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
        return `🦊 Elysia está rodando em ${urlHint}`;
      })
      .get("/test-error", () => {
        throw new Error("Test error for logs");
      })
      .get("/api/health", async () => {
        try {
          const { db } = require("./modules/infrastructure/drizzle/database");
          const { sql } = require("drizzle-orm");
          await db.execute(sql`select 1`);
          console.log("[HEALTH_CHECK] Hitting health endpoint - SUCCESS (DB Connected)");
          return {
            status: "ok",
            database: "connected",
            timestamp: new Date().toISOString(),
            version: "V2-LOCAL-DOCKER"
          };
        } catch (e) {
          console.error("[HEALTH_CHECK] DB Connection failed:", e);
          return {
            status: "error",
            database: "disconnected",
            error: String(e),
            timestamp: new Date().toISOString()
          };
        }
      })
      // Redirecionamentos Legados para compatibilidade
      .get("/get-session", ({ set }) => { set.redirect = "/api/auth/get-session"; })
      .post("/sign-in/*", ({ path, set }) => { set.redirect = `/api/auth${path}`; })
      .post("/sign-out", ({ set }) => { set.redirect = "/api/auth/sign-out"; })
      .get("/api/auth/session", ({ set }) => { set.redirect = "/api/auth/get-session"; })
      .get("/session", ({ set }) => { set.redirect = "/api/auth/get-session"; })
      .get("/api/proxy/api/auth/session", ({ set }) => { set.redirect = "/api/auth/get-session"; })
      .get("/api/proxy/session", ({ set }) => { set.redirect = "/api/auth/get-session"; })
      .get("/api/test-error", () => {
        throw new Error("Test error for logs");
      })
      .onError(({ code, error, request }) => {
        const errorMsg = `\n[ERROR_GLOBAL] ${new Date().toISOString()} ${request.method} ${request.url} ${code}: ${error}\n${error.stack}\n`;
        console.error(`\n[ERROR_GLOBAL] ${request.method} ${request.url} ${code}:`, error);
        if (error instanceof Error) {
          console.error("Stack Trace:", error.stack);
        }
        try {
          // require("fs").appendFileSync("server_debug.log", errorMsg);
        } catch (e) { }

        return {
          error: "INTERNAL_SERVER_ERROR",
          message: error.message,
          code: code,
          stack: process.env.NODE_ENV === "development" ? error.stack : undefined
        };
      });

    console.log("[STARTUP] Servidor configurado com sucesso.");
    const urlHint = process.env.BETTER_AUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
    console.log(`🦊 Elysia está rodando em ${urlHint}`);

    app.listen(3001, (server) => {
      console.log(`[STARTUP] Elysia escutando explicitamente na porta ${server.port}`);
    });

    return app;
  } catch (error) {
    console.error("ERRO DE STARTUP (CRÍTICO):", error);
    if (error instanceof Error) {
      console.error("Stack:", error.stack);
    }
    // Retorna uma instância mínima de erro para não derrubar o processo sem logs
    return new Elysia()
      .get("/api/health", () => ({ status: "startup_failed", error: String(error) }))
      .get("/*", () => {
        return {
          error: "STARTUP_FAILED",
          details: String(error),
          stack: error instanceof Error ? error.stack : undefined
        };
      });
  }
};

// Exporta a aplicação inicializada
export default startServer();
