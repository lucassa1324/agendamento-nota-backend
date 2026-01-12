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
import { reportController } from "./modules/reports/adapters/in/http/report.controller";
import { businessController } from "./modules/business/adapters/in/http/business.controller";
import { publicBusinessController } from "./modules/business/adapters/in/http/public-business.controller";

const userRepository = new UserRepository();
const createUserUseCase = new CreateUserUseCase(userRepository);
const listUsersUseCase = new ListUsersUseCase(userRepository);
const userController = new UserController(createUserUseCase, listUsersUseCase);

const app = new Elysia()
  .use(
    cors({
      origin: [
        "http://localhost:3000",
        "http://localhost:3002",
        "http://lucas-studio.localhost:3000",
        "https://agendamento-nota-front.vercel.app",
        "https://agendamento-nota-backend.vercel.app",
        ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
        ...(process.env.PLATFORM_URL ? [process.env.PLATFORM_URL] : []),
      ],
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
      exposeHeaders: ["Set-Cookie"],
    })
  )
  .mount(auth.handler)
  .onRequest(({ request }) => {
    const url = new URL(request.url);
    if (url.pathname !== "/health") {
      // Evitar flood de logs se houver healthcheck
      console.log(
        `\n[${new Date().toISOString()}] ${request.method} ${url.pathname}`
      );
      console.log(`> Origin: ${request.headers.get("origin") || "N/A"}`);
      console.log(
        `> Cookie: ${request.headers.get("cookie") ? "Presente" : "AUSENTE"}`
      );
      if (request.headers.get("cookie")) {
        console.log(
          `> Cookie Detail: ${request.headers
            .get("cookie")
            ?.substring(0, 50)}...`
        );
      }
    }
  })
  .use(publicBusinessController)
  .use(userController.registerRoutes())
  .use(appointmentController)
  .use(reportController)
  .use(businessController)
  .onError(({ code, error, set }) => {
    console.error(`\n[ERROR] ${code}:`, error);
    return {
      error: error instanceof Error ? error.message : "Unknown error",
      code,
    };
  })
  .get("/", () => "Elysia funcionando!")
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
