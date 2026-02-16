import { Elysia } from "elysia";
import { auth } from "./modules/infrastructure/auth/auth";
import { authPlugin } from "./modules/infrastructure/auth/auth-plugin";
import type { User, Session } from "./modules/infrastructure/auth/auth-plugin";
import cors from "@elysiajs/cors";
import { UserController } from "./modules/user/adapters/in/http/user.controller";
import { CreateUserUseCase } from "./modules/user/application/use-cases/create-user.use-case";
import { ListUsersUseCase } from "./modules/user/application/use-cases/list-users.use-case";
import { UserRepository } from "./modules/user/adapters/out/user.repository";
import { appointmentController } from "./modules/appointments/adapters/in/http/appointment.controller";
import { serviceController } from "./modules/services/adapters/in/http/service.controller";
import { reportController } from "./modules/reports/adapters/in/http/report.controller";
import { businessController } from "./modules/business/adapters/in/http/business.controller";
import { companyController } from "./modules/business/adapters/in/http/company.controller";
import { publicBusinessController } from "./modules/business/adapters/in/http/public-business.controller";
import { inventoryController } from "./modules/inventory/adapters/in/http/inventory.controller";
import { settingsController } from "./modules/settings/adapters/in/http/settings.controller";
import { expenseController } from "./modules/expenses/adapters/in/http/expense.controller";
import { galleryController } from "./modules/gallery/adapters/in/http/gallery.controller";
import { masterAdminController } from "./modules/business/adapters/in/http/master-admin.controller";
import { pushController } from "./modules/notifications/adapters/in/http/push.controller";
import { notificationsController } from "./modules/notifications/adapters/in/http/notifications.controller";
import { userPreferencesController } from "./modules/user/adapters/in/http/user-preferences.controller";
import { repositoriesPlugin } from "./modules/infrastructure/di/repositories.plugin";
import { staticPlugin } from "@elysiajs/static";

const userRepository = new UserRepository();
const createUserUseCase = new CreateUserUseCase(userRepository);
const listUsersUseCase = new ListUsersUseCase(userRepository);
const userController = new UserController(createUserUseCase, listUsersUseCase);

const app = new Elysia()
  .use(
    cors({
      origin: (request) => {
        const origin = request.headers.get('origin');
        if (!origin) return true;

        const allowedOrigins = [
          'http://localhost:3000',
          'http://127.0.0.1:3000',
          'https://agendamento-nota-front.vercel.app',
          'https://landingpage-agendamento-front.vercel.app'
        ];

        // 1. Permite origens exatas da lista
        if (allowedOrigins.includes(origin)) return true;

        // 2. Permite qualquer subdomínio de localhost (ex: lucas-studio.localhost:3000)
        // O regex cobre http://localhost:PORTA e http://*.localhost:PORTA
        if (origin.endsWith('.localhost:3000') || /^http:\/\/localhost:\d+$/.test(origin)) {
          return true;
        }

        // 3. Permite subdomínios da Vercel
        if (origin.endsWith('.vercel.app')) {
          return true;
        }

        return false;
      },
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
      exposeHeaders: ["Set-Cookie", "set-cookie", "Authorization"],
      preflight: true
    })
  )
  .mount(auth.handler)
  .onBeforeHandle(({ request }) => {
    const origin = request.headers.get('origin');
    const cookie = request.headers.get('cookie');
    console.log(`\n[LOG] ${request.method} ${request.url}`);
    console.log(`[LOG] Origin: ${origin}`);
    console.log(`[LOG] Cookie presente: ${cookie ? 'Sim' : 'Não'}`);
  })
  .use(publicBusinessController)
  .use(userController.registerRoutes())
  .group("/api", (api) =>
    api
      .use(appointmentController)
      .use(serviceController)
      .use(reportController)
      .use(businessController)
      .use(companyController)
      .use(inventoryController)
      .use(settingsController)
      .use(expenseController)
      .use(galleryController)
      .use(pushController)
      .use(notificationsController)
      .use(userPreferencesController)
      .use(masterAdminController)
  )
  .use(staticPlugin({
    assets: "public",
    prefix: "/public",
    alwaysStatic: false,
  }))
  .onError(({ code, error, set, body }) => {
    console.error(`\n[ERROR] ${code}:`, error);

    const errorMessage = error instanceof Error ? error.message : "";

    if (errorMessage === "BUSINESS_SUSPENDED" || errorMessage === "ACCOUNT_SUSPENDED") {
      set.status = 403;
      return {
        error: errorMessage,
        message: errorMessage === "BUSINESS_SUSPENDED"
          ? "O acesso a este estúdio foi suspenso."
          : "Sua conta foi desativada."
      };
    }

    if (code === 'VALIDATION') {
      console.error("[VALIDATION_ERROR_DETAILS]:", JSON.stringify(error.all, null, 2));
      return {
        error: "Erro de validação nos dados enviados",
        details: error.all
      };
    }

    return {
      error: error instanceof Error ? error.message : "Unknown error",
      code,
    };
  })
  .get("/", () => "Elysia funcionando!")
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
    // Para a rota /user, precisamos validar a sessão manualmente ou usar o plugin localmente
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
