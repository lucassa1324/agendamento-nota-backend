import { betterAuth } from "better-auth";
import { createAuthEndpoint } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { Resend } from "resend";
import { db } from "../drizzle/database";
import * as schema from "../../../db/schema";
import { and, eq } from "drizzle-orm";
import { verifyPassword as verifyScryptPassword } from "better-auth/crypto";
import { UserSendMail } from "../../user/adapters/out/user-send-mail.service";

export { verifyScryptPassword };

const resendKey = process.env.RESEND_API_KEY;
if (!resendKey && process.env.NODE_ENV === "production") {
  console.error("[AUTH] FATAL: RESEND_API_KEY is missing in production!");
}

const resend = new Resend(resendKey || "re_placeholder");

if (!process.env.BETTER_AUTH_SECRET) {
  console.warn("BETTER_AUTH_SECRET is missing! Using dev secret.");
}

// Configuração do baseURL: deve sempre apontar para o backend onde o Better Auth está rodando
const getBaseUrl = () => {
  if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL;
  if (process.env.BACKEND_URL) return process.env.BACKEND_URL;
  if (process.env.BASE_URL) return process.env.BASE_URL;

  // Fallback para localhost em desenvolvimento (Backend roda na 3001)
  return "http://localhost:3001";
};

const baseURL = getBaseUrl();
console.log("[AUTH] BaseURL configurado:", baseURL);

export const detectHashAlgorithm = (hash: string) => {
  if (!hash) return "empty";
  if (hash.startsWith("$argon2id$")) return "argon2id";
  if (hash.startsWith("$argon2i$")) return "argon2i";
  if (hash.startsWith("$argon2d$")) return "argon2d";
  if (hash.startsWith("$2a$") || hash.startsWith("$2b$") || hash.startsWith("$2y$")) return "bcrypt";
  if (hash.includes(":")) return "scrypt";
  return "unknown";
};

console.log("[AUTH_MODULE] Loading auth module...");

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET || "placeholder_secret_for_build",
  emailAndPassword: {
    enabled: true,
    password: {
      async verify({ hash, password }) {
        const algorithm = detectHashAlgorithm(hash);
        const hashPreview = hash ? hash.slice(0, 40) : "";
        try {
          console.log(`[AUTH_VERIFY] Incoming hash algo=${algorithm} len=${hash?.length ?? 0} preview=${hashPreview}`);
          let isCorrect = false;
          if (algorithm === "scrypt") {
            isCorrect = await verifyScryptPassword({ hash, password });
            if (isCorrect) {
              try {
                const newHash = await Bun.password.hash(password, { algorithm: "argon2id" });
                const updated = await db
                  .update(schema.account)
                  .set({ password: newHash, updatedAt: new Date() })
                  .where(and(eq(schema.account.password, hash), eq(schema.account.providerId, "credential")))
                  .returning({ id: schema.account.id });
                console.log(`[AUTH_VERIFY] Rehash scrypt->argon2id updated=${updated.length}`);
              } catch (rehashError) {
                console.error("[AUTH_VERIFY] Rehash failed:", rehashError);
              }
            }
          } else {
            isCorrect = await Bun.password.verify(password, hash);
          }
          console.log(`[AUTH_VERIFY] Password verification: ${isCorrect}`);
          return isCorrect;
        } catch (e) {
          console.error(`[AUTH_VERIFY] Error verifying password:`, e);
          console.error(`[AUTH_VERIFY] Failed hash algo=${algorithm} len=${hash?.length ?? 0} preview=${hashPreview}`);
          return false;
        }
      },
      async hash(password) {
        return await Bun.password.hash(password, { algorithm: "argon2id" });
      }
    }
  },
  baseURL: getBaseUrl(),
  trustedOrigins: [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
    "https://app.aurasistema.com.br",
    "https://aurasistema.com.br",
    "https://agendamento-nota-front.vercel.app",
    "https://landingpage-agendamento-front.vercel.app",
    ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
    ...(process.env.NEXT_PUBLIC_VERCEL_URL ? [`https://${process.env.NEXT_PUBLIC_VERCEL_URL}`] : []),
    ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
    "https://agendamento-nota-front-git-staging-lucassa1324s-projects.vercel.app", // Staging Environment
    "http://127.0.0.1:3000"
  ],
  advanced: {
    // Configuração OBRIGATÓRIA para Vercel (Cross-Site) em Produção
    // Front em agendamento-nota-front.vercel.app
    // Back em agendamento-nota-backend.vercel.app
    // Em localhost, usamos configurações mais relaxadas para evitar problemas com SSL/HTTP
    useSecureCookies: process.env.NODE_ENV === "production",
    cookie: {
      domain: undefined,
      path: "/",
      sameSite: "lax",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production"
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 dias
    updateAge: 60 * 60 * 24, // 1 dia
    cookieCache: {
      enabled: false, // Desabilitado em produção serverless para evitar inconsistências
    },
    freshAge: 0, // Força a verificação da sessão no banco se houver dúvida
  },
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: schema,
  }),
  user: {
    additionalFields: {
      cpfCnpj: {
        type: "string",
      },
      role: {
        type: "string",
      },
      active: {
        type: "boolean",
      },
      hasCompletedOnboarding: {
        type: "boolean",
      },
      acceptedTerms: {
        type: "boolean",
      },
      acceptedTermsAt: {
        type: "date",
      },
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }: { user: any; url: string }) => {
      const userSendMail = new UserSendMail();
      const verificationUrl = url.replace("/api/auth/verify-email", "/email-verified");

      try {
        await userSendMail.sendVerificationEmail(user.email, user.name, verificationUrl);
        console.log(`[AUTH] E-mail de verificação enviado com sucesso para: ${user.email}`);
      } catch (e) {
        console.error("[AUTH] Erro fatal no envio de e-mail:", e);
      }
    },
  },
  plugins: [
    {
      id: "business-data",
      hooks: {
        after: [
          {
            matcher(context) {
              const path = context?.path || "";
              return path.endsWith("/sign-in/email") || path.endsWith("/get-session");
            },
            handler: async (ctx: any) => {
              const returned = ctx?.context?.returned;

              if (returned instanceof Response) {
                return { response: returned };
              }

              if (!returned) {
                return { response: { user: null, session: null } };
              }

              try {
                // Se chegou aqui, 'returned' é um objeto JS puro { user, session } 
                if (!returned.user) return { response: returned };

                const [business] = await db
                  .select({
                    id: schema.companies.id,
                    slug: schema.companies.slug,
                    subscriptionStatus: schema.companies.subscriptionStatus,
                    trialEndsAt: schema.companies.trialEndsAt,
                  })
                  .from(schema.companies)
                  .where(eq(schema.companies.ownerId, returned.user.id))
                  .limit(1);

                if (business) {
                  console.log(`[AUTH_HOOK] Injetando dados do business para: ${business.slug}`);

                  // Injeção direta no objeto que o Better Auth já ia retornar 
                  return {
                    response: {
                      ...returned,
                      user: {
                        ...returned.user,
                        slug: business.slug,
                        businessId: business.id,
                        business: {
                          id: business.id,
                          slug: business.slug,
                          subscriptionStatus: business.subscriptionStatus,
                          trialEndsAt: business.trialEndsAt,
                        }
                      }
                    }
                  };
                }
              } catch (e) {
                console.error("[AUTH_HOOK_ERROR]", e);
              }
              // Se nada der certo (erro ou sem business), retorna o original (evita o data: null)
              return { response: returned };
            },
          }
        ]
      },
      endpoints: {
        changePassword: createAuthEndpoint(
          "/change-password",
          {
            method: "POST",
            useSession: true,
          },
          async (ctx: any) => {
            console.log(`[CHANGE_PASSWORD] 🔓 INICIANDO ENDPOINT`);
            console.log(`[CHANGE_PASSWORD] Path: ${ctx.path}`);

            // Tentar recuperar o corpo de múltiplas formas para garantir que não chegue vazio
            let body: any = {};
            try {
              // 1. Tentar ler do ctx.body (se o Elysia já tiver processado)
              if (ctx.body && Object.keys(ctx.body).length > 0) {
                body = ctx.body;
                console.log(`[CHANGE_PASSWORD] 🔍 Body recuperado via ctx.body`);
              }
              // 2. Tentar ler via ctx.request.json()
              else if (ctx.request) {
                const clonedReq = ctx.request.clone();
                body = await clonedReq.json().catch(() => ({}));
                console.log(`[CHANGE_PASSWORD] 🔍 Body recuperado via ctx.request.json()`);
              }
            } catch (e) {
              console.log(`[CHANGE_PASSWORD] ⚠️ Erro ao tentar ler body:`, e);
            }

            console.log(`[CHANGE_PASSWORD] 🔍 Keys finais:`, Object.keys(body));

            let session = ctx.context.session;

            // Fallback: Se a sessão não estiver no context (comum em endpoints customizados), tentamos buscar manualmente
            if (!session) {
              console.log(`[CHANGE_PASSWORD] Sessão não encontrada no contexto. Tentando buscar via auth.api.getSession...`);
              const authSession = await auth.api.getSession({
                headers: ctx.request.headers
              });
              if (authSession) {
                session = authSession;
                console.log(`[CHANGE_PASSWORD] Sessão recuperada manualmente para: ${session.user.email}`);
              }
            }

            if (!session) {
              console.log(`[CHANGE_PASSWORD] Falha crítica: Usuário não autenticado.`);
              return ctx.json({ error: "Não autorizado" }, { status: 401 });
            }

            if (!ctx.request) {
              return ctx.json({ error: "Corpo inválido" }, { status: 400 });
            }

            const { currentPassword, newPassword } = body;

            if (!currentPassword || !newPassword) {
              return ctx.json(
                { error: "Senha atual e nova senha são obrigatórias" },
                { status: 400 }
              );
            }

            // 1. Buscar o hash atual do usuário no banco
            const userAccount = await db
              .select()
              .from(schema.account)
              .where(
                and(
                  eq(schema.account.userId, session.user.id),
                  eq(schema.account.providerId, "credential")
                )
              )
              .limit(1);

            if (userAccount.length === 0 || !userAccount[0].password) {
              return ctx.json({ error: "Conta não encontrada" }, { status: 404 });
            }

            const currentHash = userAccount[0].password;
            const algorithm = detectHashAlgorithm(currentHash);

            // 2. Validar senha atual (Lógica Bilíngue)
            let isPasswordValid = false;
            try {
              if (algorithm === "scrypt") {
                isPasswordValid = await verifyScryptPassword({
                  hash: currentHash,
                  password: currentPassword,
                });
              } else {
                isPasswordValid = await Bun.password.verify(
                  currentPassword,
                  currentHash
                );
              }
            } catch (error) {
              console.error("[CHANGE_PASSWORD] Erro na validação:", error);
              return ctx.json({ error: "Erro ao validar senha" }, { status: 500 });
            }

            if (!isPasswordValid) {
              return ctx.json({ error: "Senha atual incorreta" }, { status: 403 });
            }

            // 3. Gerar novo hash Argon2 (Migração Forçada)
            const newHash = await Bun.password.hash(newPassword, {
              algorithm: "argon2id",
            });

            // 4. Atualizar no banco com log de confirmação
            console.log(`[CHANGE_PASSWORD] 🚀 Tentando update para userId: ${session.user.id}`);

            // Debug: Listar todas as contas desse usuário antes de atualizar
            const allAccounts = await db.select().from(schema.account).where(eq(schema.account.userId, session.user.id));
            console.log(`[CHANGE_PASSWORD] Contas encontradas para este usuário:`, allAccounts.length);
            allAccounts.forEach(acc => console.log(` - Account ID: ${acc.id}, Provider: ${acc.providerId}`));

            const updateResult = await db
              .update(schema.account)
              .set({
                password: newHash,
                updatedAt: new Date(),
              })
              .where(
                and(
                  eq(schema.account.userId, session.user.id),
                  eq(schema.account.providerId, "credential")
                )
              )
              .returning({
                id: schema.account.id,
                userId: schema.account.userId
              });

            console.log(
              `[CHANGE_PASSWORD] Resultado do Update (Raw):`, JSON.stringify(updateResult, null, 2)
            );

            if (!updateResult || updateResult.length === 0) {
              console.error("[CHANGE_PASSWORD] ❌ ERRO FATAL: Nenhuma linha atualizada!");
              return ctx.json({ error: "O banco de dados recusou a atualização da senha. Nenhuma conta correspondente foi encontrada." }, { status: 500 });
            }

            console.log(`[CHANGE_PASSWORD] ✅ SUCESSO REAL: Senha persistida no banco.`);

            if (updateResult.length === 0) {
              console.error("[CHANGE_PASSWORD] ❌ Nenhuma linha atualizada no banco!");
              return ctx.json({ error: "Falha ao persistir nova senha" }, { status: 500 });
            }

            console.log(
              `[CHANGE_PASSWORD] ✅ Senha atualizada com sucesso para ${session.user.email} (ID: ${updateResult[0].id})`
            );

            return ctx.json({ message: "Senha atualizada com sucesso" });
          }
        ),
        getBusiness: createAuthEndpoint(
          "/business-info",
          {
            method: "GET",
          },
          async (ctx) => {
            const session = ctx.context.session;
            if (!session) return ctx.json({ business: null, slug: null });

            const userId = session.user.id;
            const results = await db
              .select({
                id: schema.companies.id,
                name: schema.companies.name,
                slug: schema.companies.slug,
                ownerId: schema.companies.ownerId,
                active: schema.companies.active,
                subscriptionStatus: schema.companies.subscriptionStatus,
                trialEndsAt: schema.companies.trialEndsAt,
                createdAt: schema.companies.createdAt,
                updatedAt: schema.companies.updatedAt,
                siteCustomization: {
                  layoutGlobal: schema.companySiteCustomizations.layoutGlobal,
                  home: schema.companySiteCustomizations.home,
                  gallery: schema.companySiteCustomizations.gallery,
                },
              })
              .from(schema.companies)
              .leftJoin(
                schema.companySiteCustomizations,
                eq(schema.companies.id, schema.companySiteCustomizations.companyId)
              )
              .where(eq(schema.companies.ownerId, userId))
              .limit(1);

            if (results.length > 0) {
              return ctx.json({
                business: results[0],
                slug: results[0].slug,
              });
            }

            return ctx.json({ business: null, slug: null });
          }
        ),
      },
    },
  ],
});
