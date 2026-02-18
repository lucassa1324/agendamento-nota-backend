import { Elysia } from "elysia";
import { signinDTO } from "../dtos/signin.dto";
export class UserController {
    constructor(createUserUseCase, listUsersUseCase) {
        this.createUserUseCase = createUserUseCase;
        this.listUsersUseCase = listUsersUseCase;
    }
    registerRoutes() {
        return new Elysia({ prefix: "/users" })
            .post("/", async ({ body, set }) => {
            console.log(`\n[${new Date().toISOString()}] [USER_REGISTER] Nova requisição de cadastro recebida:`);
            console.log(`> Body:`, JSON.stringify(body, null, 2));
            try {
                const user = await this.createUserUseCase.execute(body);
                console.log(`> [USER_REGISTER] Sucesso ao criar usuário: ${user.user?.id || 'N/A'}`);
                set.status = 201;
                return user;
            }
            catch (err) {
                console.error(`> [USER_REGISTER] Erro ao processar cadastro:`, err.message);
                set.status = 400;
                return { error: err.message };
            }
        }, {
            body: signinDTO,
            onError({ error, body }) {
                console.error("\n[USER_REGISTER_VALIDATION_ERROR]");
                console.error("> Body enviado:", JSON.stringify(body, null, 2));
                console.error("> Erro de validação:", error);
            }
        })
            .get("/", async () => {
            return this.listUsersUseCase.execute();
        });
    }
}
