import { Elysia, t } from "elysia";
import { CreateUserUseCase } from "../../../application/use-cases/create-user.use-case";
import { ListUsersUseCase } from "../../../application/use-cases/list-users.use-case";
import { signinDTO } from "../dtos/signin.dto";
import { authPlugin } from "../../../../infrastructure/auth/auth-plugin";
import { db } from "../../../../infrastructure/drizzle/database";
import { user } from "../../../../../db/schema";
import { eq } from "drizzle-orm";

export class UserController {
  constructor(
    private readonly createUserUseCase: CreateUserUseCase,
    private readonly listUsersUseCase: ListUsersUseCase
  ) { }

  registerRoutes() {
    return new Elysia({ prefix: "/users" })
      .use(authPlugin)
      .post(
        "/",
        async ({ body, set }) => {
          console.log(`\n[${new Date().toISOString()}] [USER_REGISTER] Nova requisição de cadastro recebida:`);
          console.log(`> Body:`, JSON.stringify(body, null, 2));

          try {
            const user = await this.createUserUseCase.execute(body);
            console.log(`> [USER_REGISTER] Sucesso ao criar usuário: ${user.user?.id || 'N/A'}`);
            set.status = 201;
            return user;
          } catch (err: any) {
            console.error(`> [USER_REGISTER] Erro ao processar cadastro:`, err.message);
            set.status = 400;
            return { error: err.message };
          }
        },
        {
          body: signinDTO,
          onError({ error, body, set }: { error: any, body: any, set: any }) {
            console.error("\n[USER_REGISTER_VALIDATION_ERROR]");
            console.error("> Body enviado:", JSON.stringify(body, null, 2));
            console.error("> Erro de validação:", error);
            
            set.status = 400;
            return {
              error: "VALIDATION_ERROR",
              message: error.message || "Erro de validação nos dados enviados",
              details: error.all || error
            };
          }
        }
      )
      .patch(
        "/me/cpf-cnpj",
        async ({ body, user: currentUser, set }) => {
          if (!currentUser?.id) {
            set.status = 401;
            return { error: "Unauthorized" };
          }

          const normalizedCpfCnpj = body.cpfCnpj.replace(/\D/g, "");
          if (normalizedCpfCnpj.length !== 11 && normalizedCpfCnpj.length !== 14) {
            set.status = 400;
            return { error: "CPF/CNPJ inválido. Informe 11 ou 14 dígitos." };
          }

          await db
            .update(user)
            .set({
              cpfCnpj: normalizedCpfCnpj,
              updatedAt: new Date(),
            })
            .where(eq(user.id, currentUser.id));

          return {
            success: true,
            cpfCnpj: normalizedCpfCnpj,
          };
        },
        {
          body: t.Object({
            cpfCnpj: t.String({ minLength: 11 }),
          }),
        },
      )
      .get("/", async () => {
        return this.listUsersUseCase.execute();
      });
  }
}
