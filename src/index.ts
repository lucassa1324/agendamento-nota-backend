console.log("Servidor iniciando com sucesso!");

import { Elysia } from "elysia";
import { auth } from "./modules/infrastructure/auth/auth";
import { authPlugin } from "./modules/infrastructure/auth/auth-plugin";
import cors from "@elysiajs/cors";

const setupRoutes = async (app: Elysia) => {
  console.log("[SETUP_ROUTES] Iniciando carregamento das rotas");

  console.log("[SETUP_ROUTES] Importando ./modules/user/adapters/in/http/user.controller");
  const { UserController } = await import("./modules/user/adapters/in/http/user.controller");

  console.log("[SETUP_ROUTES] Importando ./modules/user/application/use-cases/list-users.use-case");
  const { ListUsersUseCase } = await import("./modules/user/application/use-cases/list-users.use-case");

  console.log("[SETUP_ROUTES] Importando ./modules/user/application/use-cases/create-user.use-case");
  const { CreateUserUseCase } = await import("./modules/user/application/use-cases/create-user.use-case");

  console.log("[SETUP_ROUTES] Importando ./modules/user/adapters/out/user.repository");
  const { UserRepository } = await import("./modules/user/adapters/out/user.repository");

  const userRepository = new UserRepository();
  const createUserUseCase = new CreateUserUseCase(userRepository);
  const listUsersUseCase = new ListUsersUseCase(userRepository);
  const userController = new UserController(createUserUseCase, listUsersUseCase);

  console.log("[SETUP_ROUTES] Importando ./modules/business/adapters/in/http/business.controller");
  const { businessController } = await import("./modules/business/adapters/in/http/business.controller");

  console.log("[SETUP_ROUTES] Importando ./modules/services/adapters/in/http/service.controller");
  const { serviceController } = await import("./modules/services/adapters/in/http/service.controller");

  console.log("[SETUP_ROUTES] Importando ./modules/reports/adapters/in/http/report.controller");
  const { reportController } = await import("./modules/reports/adapters/in/http/report.controller");

  console.log("[SETUP_ROUTES] Importando ./modules/appointments/adapters/in/http/appointment.controller");
  const { appointmentController } = await import("./modules/appointments/adapters/in/http/appointment.controller");

  console.log("[SETUP_ROUTES] Importando ./modules/settings/adapters/in/http/settings.controller");
  const { settingsController } = await import("./modules/settings/adapters/in/http/settings.controller");

  console.log("[SETUP_ROUTES] Importando ./modules/inventory/adapters/in/http/inventory.controller");
  const { inventoryController } = await import("./modules/inventory/adapters/in/http/inventory.controller");

  console.log("[SETUP_ROUTES] Importando ./modules/expenses/adapters/in/http/expense.controller");
  const { expenseController } = await import("./modules/expenses/adapters/in/http/expense.controller");

  console.log("[SETUP_ROUTES] Importando ./modules/business/adapters/in/http/master-admin.controller");
  const { masterAdminController } = await import("./modules/business/adapters/in/http/master-admin.controller");

  console.log("[SETUP_ROUTES] Importando ./modules/gallery/adapters/in/http/gallery.controller");
  const { galleryController } = await import("./modules/gallery/adapters/in/http/gallery.controller");

  console.log("[SETUP_ROUTES] Registrando rotas no app");

  return app
    .use(userController.registerRoutes())
    .group("/api", (api) =>
      api
        .use(businessController())
        .use(serviceController())
        .use(reportController())
        .use(appointmentController())
        .use(settingsController())
        .use(inventoryController())
        .use(expenseController())
        .use(masterAdminController())
        .use(galleryController())
    );
};

const app = new Elysia()
  .use(
    cors({
      origin: [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'https://agendamento-nota-front.vercel.app',
        'https://landingpage-agendamento-front.vercel.app',
        /\.localhost:3000$/,
        /^http:\/\/localhost:\d+$/,
        /\.vercel\.app$/
      ],
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
      credentials: true, // Força Access-Control-Allow-Credentials: true
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "Cookie",
        "set-cookie",
        "X-Requested-With",
        "Cache-Control"
      ],
      exposeHeaders: ["Set-Cookie", "set-cookie", "Authorization", "Cache-Control"],
      preflight: true
    })
  )
  // Força NO-CACHE em todas as respostas da API para evitar loops de redirecionamento fantasma
  .onRequest(({ set }) => {
    set.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, proxy-revalidate";
    set.headers["Pragma"] = "no-cache";
    set.headers["Expires"] = "0";
    set.headers["Surrogate-Control"] = "no-store";
  })
  .mount(auth.handler)
  // COMPATIBILIDADE: Captura rota duplicada /api/auth/api/auth gerada erroneamente pelo frontend
  .group("/api/auth", (app) => app.mount(auth.handler))
  .get("/get-session", async ({ request, set }) => {
    try {
      console.log("[GET-SESSION] Verificando sessão...");
      const session = await auth.api.getSession({
        headers: request.headers,
      });
      console.log("[GET-SESSION] Resultado:", session ? "Sessão Válida" : "Sem Sessão");
      return session || { session: null, user: null };
    } catch (error) {
      console.error("[GET-SESSION] ERRO FATAL:", error);
      // Em caso de erro, retorna nulo para evitar loop de login no frontend
      return { session: null, user: null };
    }
  })
  .use(authPlugin)
  .onBeforeHandle(({ request }) => {
    const origin = request.headers.get("origin");
  })
  .use(setupRoutes)
  .get("/api/health", () => ({ status: "ok", timestamp: new Date().toISOString() }))
  .onError(({ code, error, set, body }) => {
    console.error(`\n[ERROR] ${code}:`, error);

    const errorMessage = error instanceof Error ? error.message : "";

    if (errorMessage === "BUSINESS_SUSPENDED" || errorMessage === "ACCOUNT_SUSPENDED") {
      set.status = 403;
      return {
        error: errorMessage,
        message: errorMessage === "BUSINESS_SUSPENDED" ? "O acesso a este estúdio foi suspenso." : "Sua conta foi desativada.",
      };
    }

    if (errorMessage === "BILLING_REQUIRED") {
      set.status = 402;
      return {
        error: errorMessage,
        message: "Assinatura necessária ou trial expirado.",
        redirect: "/billing-required",
      };
    }

    if (code === "VALIDATION") {
      console.error("[VALIDATION_ERROR_DETAILS]:", JSON.stringify((error as any).all, null, 2));
      return {
        error: "Erro de validação nos dados enviados",
        details: (error as any).all,
      };
    }

    return {
      error: error instanceof Error ? error.message : "Unknown error",
      code,
    };
  })
  .get("/", () => "Elysia funcionando - User & Auth ativados!")
  .get("/diagnostics/headers", async ({ request }) => {
    const origin = request.headers.get("origin") || null;
    const cookie = request.headers.get("cookie") || null;
    const authorization = request.headers.get("authorization") || null;
    const userAgent = request.headers.get("user-agent") || null;
    const session = await auth.api.getSession({ headers: request.headers });
    return {
      method: request.method,
      origin,
      cookiePresent: !!cookie,
      cookiePreview: cookie ? `${cookie.slice(0, 80)}${cookie.length > 80 ? "..." : ""}` : null,
      authorizationPresent: !!authorization,
      userAgent,
      sessionFound: !!session,
      userId: session?.user?.id || null,
    };
  })
  .get("/user", async ({ request, set }) => {
    const session = await auth.api.getSession({
      headers: request.headers,
    });
    if (!session) {
      set.status = 401;
      return { error: "Unauthorized" };
    }
    return session.user;
  });

export default app;
