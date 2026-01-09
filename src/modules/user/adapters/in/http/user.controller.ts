import { Elysia, t } from "elysia";
import { CreateUserUseCase } from "../../../application/use-cases/create-user.use-case";
import { ListUsersUseCase } from "../../../application/use-cases/list-users.use-case";
import { signinDTO } from "../dtos/signin.dto";

export class UserController {
  constructor(
    private readonly createUserUseCase: CreateUserUseCase,
    private readonly listUsersUseCase: ListUsersUseCase
  ) { }

  registerRoutes() {
    return new Elysia({ prefix: "/users" })
      .post(
        "/",
        async ({ body, set }) => {
          try {
            const user = await this.createUserUseCase.execute(body);
            set.status = 201;
            return user;
          } catch (error: any) {
            set.status = 400;
            return { error: error.message };
          }
        },
        {
          body: signinDTO,
        }
      )
      .get("/", async () => {
        return this.listUsersUseCase.execute();
      });
  }
}
