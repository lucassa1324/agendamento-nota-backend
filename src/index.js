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
        const { auth, detectHashAlgorithm, verifyScryptPassword } = require("./modules/infrastructure/auth/auth");
        const { authPlugin } = require("./modules/infrastructure/auth/auth-plugin");
        const { repositoriesPlugin } = require("./modules/infrastructure/di/repositories.plugin");
        const { db } = require("./modules/infrastructure/drizzle/database");
        const schema = require("./db/schema");
        const { asaas } = require("./modules/infrastructure/payment/asaas.client");
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
            .all("/api/auth/*", async (ctx) => {
            console.log(`>>> [AUTH_HANDLER_START] ${ctx.request.method} ${ctx.path}`);
            try {
                // Passamos a requisição original. O Better Auth sabe lidar com ela.
                // Se o Elysia já parseou o corpo, ele estará em ctx.body.
                const response = await auth.handler(ctx.request);
                console.log(`<<< [AUTH_HANDLER_END] Status: ${response.status}`);
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
            }
            catch (e) {
                console.error(`!!! [AUTH_HANDLER_ERROR] ${e.message}`, e.stack);
                throw e;
            }
        })
            .onRequest(({ request, set }) => {
            console.log(`>>> [BACKEND_RECEIVE] ${request.method} ${new URL(request.url).pathname}`);
            console.log(`--- [DEBUG_HEADERS] Content-Type: ${request.headers.get("content-type")}`);
            console.log(`--- [DEBUG_HEADERS] User-Agent: ${request.headers.get("user-agent")}`);
            console.log(`--- [DEBUG_HEADERS] Referer: ${request.headers.get("referer")}`);
            console.log(`--- [DEBUG_HEADERS] X-Forwarded-For: ${request.headers.get("x-forwarded-for")}`);
            if (request.method === "OPTIONS") {
                const origin = request.headers.get("origin");
                const allowedOrigins = [
                    'http://localhost:3000',
                    'http://127.0.0.1:3000',
                    'https://agendamento-nota-front.vercel.app',
                    'https://landingpage-agendamento-front.vercel.app',
                    'https://agendamento-nota-front-git-staging-lucassa1324s-projects.vercel.app'
                ];
                const isAllowed = allowedOrigins.includes(origin) ||
                    (origin && origin.match(/http:\/\/.*\.localhost:\d+$/)) ||
                    (origin && origin.match(/\.vercel\.app$/)) ||
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
                'http://127.0.0.1:3000',
                'https://agendamento-nota-front.vercel.app',
                'https://landingpage-agendamento-front.vercel.app',
                'https://agendamento-nota-front-git-staging-lucassa1324s-projects.vercel.app'
            ];
            const isAllowed = allowedOrigins.includes(origin) ||
                (origin && origin.match(/http:\/\/.*\.localhost:\d+$/)) ||
                (origin && origin.match(/\.vercel\.app$/)) ||
                (origin && origin.endsWith('.vercel.app'));
            if (isAllowed && origin) {
                set.headers["Access-Control-Allow-Origin"] = origin;
                set.headers["Access-Control-Allow-Credentials"] = "true";
                set.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH";
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
            .group("/api", (api) => api
            .group("/account", (account) => account
            .onBeforeHandle(({ user, set }) => {
            if (!user) {
                set.status = 401;
                return { error: "Unauthorized" };
            }
        })
            .patch("/complete-onboarding", async ({ user }) => {
            await db.update(schema.user)
                .set({ hasCompletedOnboarding: true })
                .where(eq(schema.user.id, user.id));
            return { success: true };
        })
            .post("/cancel-feedback", async ({ user, body, set }) => {
            const { reason, details, customReason } = body;
            if (!reason) {
                set.status = 422;
                return { error: "Missing reason" };
            }
            await db.insert(schema.accountCancellationFeedback).values({
                id: crypto.randomUUID(),
                userId: user.id,
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
                .where(eq(schema.user.id, user.id))
                .limit(1);
            const last = currentUser?.lastRetentionDiscountAt
                ? new Date(currentUser.lastRetentionDiscountAt)
                : null;
            const now = new Date();
            let available = true;
            let nextEligibleAt = null;
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
            const { subscriptionId } = body;
            // 1. Registra que o usuário aceitou a oferta no banco
            await db.update(schema.user)
                .set({
                lastRetentionDiscountAt: new Date(),
                // Opcional: você pode querer resetar o status se ele estava "PENDING_CANCELLATION"
                accountStatus: "ACTIVE",
                cancellationRequestedAt: null,
                retentionEndsAt: null
            })
                .where(eq(schema.user.id, user.id));
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
            const { subscriptionId } = body;
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
                .where(eq(schema.user.id, user.id));
            return {
                success: true,
                status: "PENDING_CANCELLATION",
                retentionEndsAt
            };
        }, {
            body: t.Object({
                subscriptionId: t.Optional(t.String())
            })
        }))
            .use(businessController())
            .use(serviceController())
            .use(reportController())
            .use(appointmentController())
            .use(settingsController ? settingsController() : (app) => app) // Fallback seguro se settingsController falhar
            .use(inventoryController())
            .use(expenseController())
            .use(masterAdminController())
            .use(galleryController())
            .use(storageController())
            .use(notificationsController())
            .use(pushController())
            .use(userPreferencesController())
            .use(paymentController()))
            .get("/", () => {
            const urlHint = process.env.BETTER_AUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
            return `🦊 Elysia está rodando em ${urlHint}`;
        })
            .get("/test-error", () => {
            throw new Error("Test error for logs");
        })
            .get("/api/health", () => {
            console.log("[HEALTH_CHECK] Hitting health endpoint - SUCCESS");
            return { status: "ok", timestamp: new Date().toISOString(), version: "V2-TRY-CATCH-LOG" };
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
            }
            catch (e) { }
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
    }
    catch (error) {
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
