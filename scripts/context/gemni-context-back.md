# Contexto Backend - Agendamento Nota

Este arquivo contém o código fonte do backend para referência.

**Arquivos processados:**
- src/index.ts
- src/modules/infrastructure/auth/auth.ts
- src/modules/infrastructure/drizzle/database.ts
- src/modules/infrastructure/di/repositories.plugin.ts

---

## Arquivo: `src/index.ts`
**Caminho completo:** `C:\Users\programacao\aura\agendamento_nota\back_end\src/index.ts`

```typescript
import { Elysia } from "elysia";
import { auth } from "./modules/infrastructure/auth/auth";
import { authPlugin } from "./modules/infrastructure/auth/auth-plugin";
import { createRepositoriesPlugin } from "./modules/infrastructure/di/repositories.plugin";

// Controllers
import { userController } from "./modules/user/adapters/in/http/user.controller";
import { businessController } from "./modules/business/adapters/in/http/business.controller";
import { serviceController } from "./modules/services/adapters/in/http/service.controller";
import { reportController } from "./modules/reports/adapters/in/http/report.controller";
import { appointmentController } from "./modules/appointments/adapters/in/http/appointment.controller";
import { staffController } from "./modules/staff/adapters/in/http/staff.controller";
import { settingsController } from "./modules/settings/adapters/in/http/settings.controller";
import { inventoryController } from "./modules/inventory/adapters/in/http/inventory.controller";
import { expenseController } from "./modules/expenses/adapters/in/http/expense.controller";
import { masterAdminController } from "./modules/business/adapters/in/http/master-admin.controller";
import { galleryController } from "./modules/gallery/adapters/in/http/gallery.controller";
import { storageController } from "./modules/infrastructure/storage/storage.controller";
import { notificationsController } from "./modules/notifications/adapters/in/http/notifications.controller";
import { pushController } from "./modules/notifications/adapters/in/http/push.controller";
import { userPreferencesController } from "./modules/user/adapters/in/http/user-preferences.controller";
import { paymentController } from "./modules/infrastructure/payment/payment.controller";
import { asaasWebhookController } from "./modules/infrastructure/payment/asaas.webhook.controller";
import { billingController } from "./modules/billing/adapters/in/http/billing.controller";
import { dnsController } from "./modules/dns/infrastructure/adapters/in/http/dns.controller";

let appInstance: Elysia<any, any, any, any, any, any, any> | null = null;

function createElysiaApp() {
  console.log("[STARTUP] Preparando app Elysia (src/index.ts)");

  const app = new Elysia({ name: 'AgendamentoNota' });

  return app
    .group("/api", (api) =>
      api
        .use(authPlugin)
        .use(createRepositoriesPlugin()) // Lazy initialization do plugin de repositórios
        .use(userController())
        .use(businessController())
        .use(serviceController())
        .use(reportController())
        .use(appointmentController())
        .use(staffController())
        .use(settingsController())
        .use(inventoryController())
        .use(expenseController())
        .use(masterAdminController())
        .use(galleryController())
        .use(storageController())
        .use(notificationsController())
        .use(pushController())
        .use(userPreferencesController())
        .use(paymentController())
        .use(asaasWebhookController)
        .use(billingController())
        .use(dnsController())
        .all("/auth/*", async (ctx) => {
          console.log(`>>> [AUTH_HANDLER] ${ctx.request.method} ${ctx.path}`);
          try {
            const response = await auth.handler(ctx.request);
            console.log(`<<< [AUTH_HANDLER] Status: ${response.status}`);
            return response;
          } catch (error: any) {
            console.error(`<<< [AUTH_HANDLER_ERROR]`, error);
            return new Response(
              JSON.stringify({ error: "Auth handler error", message: error?.message || "Unknown error" }),
              { status: 500, headers: { "Content-Type": "application/json" } }
            );
          }
        })
        .get("/health", () => ({
          status: "ok",
          timestamp: new Date().toISOString(),
        }))
    );
}

export function createApp(): Elysia<any, any, any, any, any, any, any> {
  if (appInstance) {
    return appInstance;
  }

  appInstance = createElysiaApp();

  if (process.env.NODE_ENV !== "production") {
    appInstance.listen(3001);
    console.log(`🦊 Elysia está rodando em http://localhost:3001`);
  }

  return appInstance!;
}
```

---

## Arquivo: `src/modules/infrastructure/auth/auth.ts`
**Caminho completo:** `C:\Users\programacao\aura\agendamento_nota\back_end\src/modules/infrastructure/auth/auth.ts`

```typescript
import { betterAuth } from "better-auth";
import { createAuthEndpoint } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { Resend } from "resend";
import { getDB } from "../drizzle/database"; // Importa a função lazy
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

type ResolvedBusinessAccess = {
  id: string;
  slug: string;
  subscriptionStatus: string | null;
  trialEndsAt: Date | null;
  asaasSubscriptionId: string | null;
  viaStaff: boolean;
  staffIsAdmin: boolean;
};

const resolveBusinessAccessForUser = async (
  userId: string,
): Promise<ResolvedBusinessAccess | null> => {
  const [ownedBusiness] = await getDB()
    .select({
      id: schema.companies.id,
      slug: schema.companies.slug,
      subscriptionStatus: schema.companies.subscriptionStatus,
      trialEndsAt: schema.companies.trialEndsAt,
      asaasSubscriptionId: schema.companies.asaasSubscriptionId,
    })
    .from(schema.companies)
    .where(eq(schema.companies.ownerId, userId))
    .limit(1);

  if (ownedBusiness) {
    return {
      ...ownedBusiness,
      subscriptionStatus: ownedBusiness.subscriptionStatus ?? null,
      trialEndsAt: ownedBusiness.trialEndsAt ?? null,
      asaasSubscriptionId: ownedBusiness.asaasSubscriptionId ?? null,
      viaStaff: false,
      staffIsAdmin: true,
    };
  }

  const [staffBusiness] = await getDB()
    .select({
      id: schema.companies.id,
      slug: schema.companies.slug,
      subscriptionStatus: schema.companies.subscriptionStatus,
      trialEndsAt: schema.companies.trialEndsAt,
      asaasSubscriptionId: schema.companies.asaasSubscriptionId,
      staffIsAdmin: schema.staff.isAdmin,
    })
    .from(schema.staff)
    .innerJoin(schema.companies, eq(schema.staff.companyId, schema.companies.id))
    .where(and(eq(schema.staff.userId, userId), eq(schema.staff.isActive, true)))
    .limit(1);

  if (!staffBusiness) return null;

  return {
    id: staffBusiness.id,
    slug: staffBusiness.slug,
    subscriptionStatus: staffBusiness.subscriptionStatus ?? null,
    trialEndsAt: staffBusiness.trialEndsAt ?? null,
    asaasSubscriptionId: staffBusiness.asaasSubscriptionId ?? null,
    viaStaff: true,
    staffIsAdmin: Boolean(staffBusiness.staffIsAdmin),
  };
};

console.log("[AUTH_MODULE] Loading auth module...");

export const auth = betterAuth({
  telemetry: { enabled: false },
  secret: process.env.BETTER_AUTH_SECRET || "placeholder_secret_for_build",
  basePath: "/auth", // Caminho relativo ao prefixo /api do Elysia
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
                const updated = await getDB()
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
  database: drizzleAdapter(getDB(), {
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

                const business = await resolveBusinessAccessForUser(returned.user.id);

                if (business) {
                  console.log(
                    `[AUTH_HOOK] Injetando dados do business para: ${business.slug} (viaStaff=${business.viaStaff})`,
                  );

                  // Injeção direta no objeto que o Better Auth já ia retornar 
                  return {
                    response: {
                      ...returned,
                      user: {
                        ...returned.user,
                        role:
                          business.viaStaff && !business.staffIsAdmin
                            ? "USER"
                            : returned.user.role || "ADMIN",
                        slug: business.slug,
                        businessId: business.id,
                        business: {
                          id: business.id,
                          slug: business.slug,
                          subscriptionId: business.asaasSubscriptionId,
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
            const userAccount = await getDB()
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
            const allAccounts = await getDB().select().from(schema.account).where(eq(schema.account.userId, session.user.id));
            console.log(`[CHANGE_PASSWORD] Contas encontradas para este usuário:`, allAccounts.length);
            allAccounts.forEach(acc => console.log(` - Account ID: ${acc.id}, Provider: ${acc.providerId}`));

            const updateResult = await getDB()
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
            let [result] = await getDB()
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

            if (!result) {
              const [staffBusiness] = await getDB()
                .select({ companyId: schema.staff.companyId })
                .from(schema.staff)
                .where(and(eq(schema.staff.userId, userId), eq(schema.staff.isActive, true)))
                .limit(1);

              if (staffBusiness?.companyId) {
                const [staffResult] = await getDB()
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
                  .where(eq(schema.companies.id, staffBusiness.companyId))
                  .limit(1);

                result = staffResult;
              }
            }

            if (result) {
              return ctx.json({
                business: result,
                slug: result.slug,
              });
            }

            return ctx.json({ business: null, slug: null });
          }
        ),
      },
    },
  ],
});
```

---

## Arquivo: `src/modules/infrastructure/drizzle/database.ts`
**Caminho completo:** `C:\Users\programacao\aura\agendamento_nota\back_end\src/modules/infrastructure/drizzle/database.ts`

```typescript
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

if (!process.env.DATABASE_URL) {
    console.error("CRITICAL ERROR: DATABASE_URL is not defined in environment variables.");
}

const dbUrl = process.env.DATABASE_URL || "";

if (dbUrl.includes("localhost") || dbUrl.includes("127.0.0.1")) {
    console.log(">>> [DB] Conectado ao PostgreSQL Local (Docker) na porta 5432");
}

let _queryClient: ReturnType<typeof postgres> | null = null;
let _db: ReturnType<typeof drizzle> | null = null;

export function getDB() {
    if (_db) {
        return _db;
    }

    // Configuração resiliente do client Postgres (lazy)
    _queryClient = postgres(dbUrl, {
        prepare: false, // Otimização para serverless
        connect_timeout: 10,
    });

    _db = drizzle(_queryClient, {
        logger: process.env.NODE_ENV === "production" ? false : true
    });

    console.log("[DB] Instância do banco inicializada sob demanda");
    return _db;
}

// Mantém a exportação para compatibilidade, mas agora é lazy
export const db = new Proxy({} as ReturnType<typeof drizzle>, {
    get(target, prop) {
        const database = getDB();
        return (database as any)[prop];
    }
});
```

---

## Arquivo: `src/modules/infrastructure/di/repositories.plugin.ts`
**Caminho completo:** `C:\Users\programacao\aura\agendamento_nota\back_end\src/modules/infrastructure/di/repositories.plugin.ts`

```typescript
import { Elysia } from "elysia";
import { DrizzleBusinessRepository } from "../../business/adapters/out/drizzle/business.drizzle.repository";
import { DrizzleAppointmentRepository } from "../../appointments/adapters/out/drizzle/appointment.drizzle.repository";
import { DrizzleServiceRepository } from "../../services/adapters/out/drizzle/service.drizzle.repository";
import { DrizzleInventoryRepository } from "../../inventory/adapters/out/drizzle/inventory.drizzle.repository";
import { DrizzleSettingsRepository } from "../../settings/adapters/out/drizzle/settings.drizzle.repository";
import { DrizzleExpenseRepository } from "../../expenses/adapters/out/drizzle/expense.drizzle.repository";
import { GalleryDrizzleRepository } from "../../gallery/adapters/out/drizzle/gallery.drizzle.repository";
import { DrizzlePushSubscriptionRepository } from "../../notifications/adapters/out/drizzle/push-subscription.drizzle.repository";
import { UserRepository } from "../../user/adapters/out/user.repository";

export function createRepositoriesPlugin() {
    return new Elysia({ name: "repositories-plugin" })
        .decorate("businessRepository", new DrizzleBusinessRepository())
        .decorate("userRepository", new UserRepository())
        .decorate("appointmentRepository", new DrizzleAppointmentRepository())
        .decorate("serviceRepository", new DrizzleServiceRepository())
        .decorate("inventoryRepository", new DrizzleInventoryRepository())
        .decorate("settingsRepository", new DrizzleSettingsRepository())
        .decorate("expenseRepository", new DrizzleExpenseRepository())
        .decorate("galleryRepository", new GalleryDrizzleRepository())
        .decorate("pushSubscriptionRepository", new DrizzlePushSubscriptionRepository());
}

// Mantém exportação para compatibilidade (lazy se chamado dentro de createApp)
export const repositoriesPlugin = createRepositoriesPlugin();
```

---

