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
        ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
        ...(process.env.PLATFORM_URL ? [process.env.PLATFORM_URL] : []),
      ],
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  )
  .mount(auth.handler)
  .use(authPlugin)
  .use(userController.registerRoutes())
  .use(appointmentController)
  .use(reportController)
  .get("/user", ({ user }: { user: User | null }) => user, {
    auth: true,
  })
  .listen(3001);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
