console.log("[STARTUP] Inicializando Back-end com Try-Catch Global");

// Validação CRÍTICA de variáveis de ambiente antes de qualquer coisa
if (!process.env.DATABASE_URL) {
  console.error("FATAL: DATABASE_URL IS MISSING");
  throw new Error("DATABASE_URL IS MISSING");
}

if (!process.env.BETTER_AUTH_SECRET) {
  console.warn("WARNING: BETTER_AUTH_SECRET IS MISSING");
}

import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";

// Definição da App Wrapper para capturar erros de importação/inicialização
const startServer = () => {
  try {
    console.log("[STARTUP] Carregando módulos...");

    // Imports dentro do try-catch para capturar erros de linkagem/dependência circular
    const { auth } = require("./modules/infrastructure/auth/auth");
    const { authPlugin } = require("./modules/infrastructure/auth/auth-plugin");
    
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

    console.log("[STARTUP] Módulos carregados. Instanciando dependências...");

    // Instanciação de Dependências Globais
    const userRepository = new UserRepository();
    const createUserUseCase = new CreateUserUseCase(userRepository);
    const listUsersUseCase = new ListUsersUseCase(userRepository);
    const userController = new UserController(createUserUseCase, listUsersUseCase);

    console.log("[STARTUP] Criando instância do Elysia...");

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
          credentials: true,
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
      .onRequest(({ set }) => {
        set.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, proxy-revalidate";
        set.headers["Pragma"] = "no-cache";
        set.headers["Expires"] = "0";
      })
      .mount(auth.handler)
      .group("/api/auth", (app) => app.mount(auth.handler))
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
          .use(businessController())
          .use(serviceController())
          .use(reportController())
          .use(appointmentController())
          .use(settingsController()) // Aqui pode falhar se settingsController for undefined
          .use(inventoryController())
          .use(expenseController())
          .use(masterAdminController())
          .use(galleryController())
      )
      .get("/api/health", () => ({ status: "ok", timestamp: new Date().toISOString(), version: "V2-TRY-CATCH" }))
      .onError(({ code, error }) => {
        console.error(`\n[ERROR] ${code}:`, error);
      });

    console.log("[STARTUP] Servidor configurado com sucesso.");
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
