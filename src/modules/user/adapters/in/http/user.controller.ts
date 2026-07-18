import { Elysia, t } from "elysia";
import { createHash, createHmac } from "node:crypto";
import { CreateUserUseCase } from "../../../application/use-cases/create-user.use-case";
import { ListUsersUseCase } from "../../../application/use-cases/list-users.use-case";
import { GenerateMagicLinkUseCase } from "../../../application/use-cases/magic-link/generate-magic-link.use-case";
import { ValidateMagicLinkUseCase, MagicLinkNotFoundError, MagicLinkExpiredError, MagicLinkAlreadyConsumedError } from "../../../application/use-cases/magic-link/validate-magic-link.use-case";
import { signinDTO } from "../dtos/signin.dto";
import { authPlugin } from "../../../../infrastructure/auth/auth-plugin";
import { db } from "../../../../infrastructure/drizzle/database";
import { user, session as sessionTable } from "../../../../../db/schema";
import { eq } from "drizzle-orm";
import { UserAlreadyExistsError } from "../../../domain/error/user-already-exists.error";

export class UserController {
  constructor(
    private readonly createUserUseCase: CreateUserUseCase,
    private readonly listUsersUseCase: ListUsersUseCase,
    private readonly generateMagicLinkUseCase: GenerateMagicLinkUseCase,
    private readonly validateMagicLinkUseCase: ValidateMagicLinkUseCase,
  ) { }

  registerRoutes() {
    return new Elysia({ prefix: "/api/users" })
      .use(authPlugin)
      .post(
        "/magic-link",
        async ({ body, set }) => {
          try {
            const result = await this.generateMagicLinkUseCase.execute(body);
            return result;
          } catch (err: any) {
            set.status = 400;
            return { error: "FALHA_AO_GERAR_LINK", message: err.message };
          }
        },
        {
          body: t.Object({
            userId: t.String(),
            companyId: t.Optional(t.String()),
            expirationHours: t.Optional(t.Number()),
            singleUse: t.Optional(t.Boolean()),
          }),
        },
      )
      .post(
        "/magic-link/validate",
        async ({ body, set }) => {
          try {
            const record = await this.validateMagicLinkUseCase.execute(body.token);
            if (!record.userId) {
              set.status = 400;
              return { error: "LINK_SEM_USUARIO", message: "Este link mágico não está associado a nenhum usuário." };
            }

            const [userRow] = await db
              .select()
              .from(user)
              .where(eq(user.id, record.userId))
              .limit(1);

            if (!userRow) {
              set.status = 404;
              return { error: "USUARIO_NAO_ENCONTRADO", message: "Usuário vinculado ao link não encontrado." };
            }

            console.log(`>>> [MAGIC_LINK] Validando link para userId=${userRow.id} email=${userRow.email} role=${userRow.role}`);

            const rawToken = crypto.randomUUID();
            const sessionId = crypto.randomUUID();
            const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

            const sessionSecret = process.env.BETTER_AUTH_SECRET || "placeholder_secret_for_build";
            const sig = createHmac("sha256", sessionSecret).update(rawToken).digest("base64");
            const signedCookie = `${rawToken}.${sig}`;

            await db.insert(sessionTable).values({
              id: sessionId,
              token: rawToken,
              userId: record.userId,
              expiresAt,
            });

            const isProduction = process.env.NODE_ENV === "production";
            const secureFlag = isProduction ? "; Secure" : "";
            const cookieName = isProduction ? "__Secure-better-auth.session_token" : "better-auth.session_token";
            set.headers["Set-Cookie"] = `${cookieName}=${signedCookie}; Path=/; HttpOnly; SameSite=Lax${secureFlag}; Max-Age=${7 * 24 * 60 * 60}`;

            return {
              success: true,
              user: {
                id: userRow.id,
                name: userRow.name,
                email: userRow.email,
                role: userRow.role,
              },
              session: {
                id: sessionId,
                token: rawToken,
                expiresAt,
              },
            };
          } catch (err: any) {
            if (err instanceof MagicLinkNotFoundError) {
              set.status = 404;
              return { error: "LINK_INVALIDO", message: err.message };
            }
            if (err instanceof MagicLinkExpiredError) {
              set.status = 410;
              return { error: "LINK_EXPIRADO", message: err.message };
            }
            if (err instanceof MagicLinkAlreadyConsumedError) {
              set.status = 409;
              return { error: "LINK_JA_UTILIZADO", message: err.message };
            }
            set.status = 400;
            return { error: "FALHA_AO_VALIDAR_LINK", message: err.message };
          }
        },
        {
          body: t.Object({
            token: t.String(),
          }),
        },
      )
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
            if (err instanceof UserAlreadyExistsError) {
              set.status = 409;
              return { error: "USUÁRIO_JÁ_EXISTE", message: err.message };
            }

            set.status = 400;
            return { error: "FALHA_NO_REGISTRO", message: err.message };
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
              error: "ERRO_DE_VALIDAÇÃO",
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
            return { error: "Não autorizado" };
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
