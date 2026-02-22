import { betterAuth } from "better-auth";
import { createAuthEndpoint } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../drizzle/database";
import * as schema from "../../../db/schema";
import { eq } from "drizzle-orm";

if (!process.env.BETTER_AUTH_SECRET) {
  console.warn("BETTER_AUTH_SECRET is missing! Using dev secret.");
}

// Melhor resolução da URL base para Vercel
const getBaseUrl = () => {
  if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL;

  // Em produção, preferimos usar a URL do Proxy do Front-end como Base URL
  // Isso garante que redirects (magic links, etc) apontem para o domínio do front
  if (process.env.FRONTEND_URL) return `${process.env.FRONTEND_URL}/api-proxy`;

  // Fallback para variáveis públicas se disponíveis
  if (process.env.NEXT_PUBLIC_FRONT_URL) return `${process.env.NEXT_PUBLIC_FRONT_URL}/api-proxy`;

  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
};

// Em ambiente Vercel com Proxy, precisamos confiar no host que vem do cabeçalho
// para que o Better Auth gere as URLs de redirecionamento corretas
const baseURL = getBaseUrl();

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET || "placeholder_secret_for_build",
  emailAndPassword: {
    enabled: true,
  },
  baseURL: baseURL, // RESTAURADO: baseURL deve apontar para o Proxy
  trustedOrigins: [
    "http://localhost:3000",
    "http://localhost:3001",
    "https://agendamento-nota-front.vercel.app",
    "https://landingpage-agendamento-front.vercel.app",
    ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
    ...(process.env.NEXT_PUBLIC_VERCEL_URL ? [`https://${process.env.NEXT_PUBLIC_VERCEL_URL}`] : []),
    ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
    "https://agendamento-nota-front.vercel.app/api-proxy" // Adicionado explicitamente o caminho do proxy
  ],
  advanced: {
    // Configuração OBRIGATÓRIA para Vercel (Cross-Site) em Produção
    // Front em agendamento-nota-front.vercel.app
    // Back em agendamento-nota-backend.vercel.app
    // Em localhost, usamos configurações mais relaxadas para evitar problemas com SSL/HTTP
    useSecureCookies: process.env.NODE_ENV === "production",
    defaultCookieAttributes: {
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      path: "/"
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
      role: {
        type: "string",
      },
      active: {
        type: "boolean",
      },
    },
  },
  hooks: {
    before: async (context: any) => {
      // Bloqueia login de usuários inativos
      if (context.path.includes("/sign-in")) {
        const body = context.body;
        if (body && body.email) {
          const [usr] = await db
            .select()
            .from(schema.user)
            .where(eq(schema.user.email, body.email))
            .limit(1);

          if (usr && usr.active === false) {
            return {
              response: new Response(JSON.stringify({
                error: "Account inactive",
                message: "Sua conta está desativada. Entre em contato com o administrador."
              }), {
                status: 403,
                headers: new Headers({ "Content-Type": "application/json" }),
              }),
            };
          }
        }
      }

      // Normalização preventiva de headers para evitar erro forEach no Better Auth interno
      if (context.headers && !(context.headers instanceof Headers)) {
        try {
          context.headers = new Headers(context.headers);
        } catch (e) { }
      }

      const path = context.path || "";

      // Proteção contra 500 no sign-out se não houver sessão
      if (path.includes("/sign-out")) {
        try {
          const session = await auth.api.getSession({
            headers: context.headers,
          });

          if (!session) {
            return {
              response: new Response(JSON.stringify({ success: true }), {
                status: 200,
                headers: new Headers({ "Content-Type": "application/json" }),
              }),
            };
          }
        } catch (e) {
          console.error("[AUTH_BEFORE_HOOK] Erro ao verificar sessão no sign-out:", e);
        }
      }
      return;
    },
    after: async (context: any) => {
      const path = context.path || "";
      let response = context.response || context.context?.returned;

      try {
        // Se houver erro, sempre retornamos uma Response com headers válidos
        if (context.error) {
          const isSignIn = path.includes("/sign-in");
          const status = isSignIn ? 401 : 500;
          const body = isSignIn
            ? {
              error: context.error?.message || "Authentication failed",
              message: "Credenciais inválidas ou erro de autenticação",
            }
            : { error: context.error?.message || "Internal error" };
          return new Response(JSON.stringify(body), {
            status,
            headers: new Headers({ "Content-Type": "application/json" }),
          });
        }

        // Se status >= 400, garantimos headers válidos e retornamos
        if (response && response.status >= 400) {
          if (response.headers && !(response.headers instanceof Headers)) {
            try {
              response.headers = new Headers(response.headers);
            } catch { }
          }
          return response;
        }

        // Fallback seguro para /get-session removido para evitar redundância e erros de parsing de cookie.
        // A lógica abaixo (ENRIQUECIMENTO DE DADOS) manipulará a resposta original do Better Auth,
        // que é mais segura e já validou o token corretamente.

        // Se for sign-out, garantimos um retorno JSON para evitar Unexpected EOF no front
        if (path.includes("/sign-out")) {
          // CAPTURA CRÍTICA: Preserva os headers originais (Set-Cookie) do Better Auth
          const originalHeaders = new Headers();
          if (response && response.headers) {
            response.headers.forEach((value: string, key: string) => {
              originalHeaders.append(key, value);
            });
          }
          // Garante Content-Type
          originalHeaders.set("Content-Type", "application/json");

          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: originalHeaders
          });
        }

        // Apenas processamos sucesso para caminhos de autenticação específicos
        const isAuthPath =
          path.startsWith("/sign-in") ||
          path.startsWith("/sign-up") ||
          path.startsWith("/get-session");

        if (!isAuthPath) {
          return response || {};
        }

        // Se response for null/undefined, significa que o Better Auth não retornou nada.
        // Isso não deveria acontecer para /get-session se a sessão for válida.
        // Se acontecer, retornamos um objeto vazio para evitar crash no Better Auth (TypeError: null is not an object).
        if (!response) {
          return {};
        }

        // --- ENRIQUECIMENTO DE DADOS (BUSINESS / SLUG) ---
        // Se response for um objeto Response (o que é comum no Better Auth), precisamos ler o body
        let data: any = null;
        let isResponseObject = response instanceof Response;

        if (isResponseObject) {
          try {
            data = await response.json();
          } catch (e) {
            return response; // Se não for JSON, retorna original
          }
        } else {
          data = response;
        }

        const user = data.user || data.session?.user;

        if (user && user.id) {
          try {
            // BLOQUEIO EM TEMPO REAL: Se o usuário estiver desativado no banco
            // Buscamos o status atualizado do usuário
            const userStatus = await db
              .select({ active: schema.user.active })
              .from(schema.user)
              .where(eq(schema.user.id, user.id))
              .limit(1);

            if (userStatus[0] && userStatus[0].active === false) {
              console.warn(`[AUTH_BLOCK]: Conta desativada - ${user.email}`);
              const errorBody = {
                error: "ACCOUNT_SUSPENDED",
                message: "Sua conta foi desativada."
              };

              return new Response(JSON.stringify(errorBody), {
                status: 403,
                headers: new Headers({ "Content-Type": "application/json" }),
              });
            }

            const results = await db
              .select({
                id: schema.companies.id,
                name: schema.companies.name,
                slug: schema.companies.slug,
                ownerId: schema.companies.ownerId,
                active: schema.companies.active,
                subscriptionStatus: schema.companies.subscriptionStatus,
                trialEndsAt: schema.companies.trialEndsAt,
              })
              .from(schema.companies)
              .where(eq(schema.companies.ownerId, user.id))
              .limit(1);

            const userCompany = results[0];

            if (userCompany) {
              // BLOQUEIO EM TEMPO REAL: Se o estúdio estiver desativado no banco
              if (userCompany.active === false && user.role !== "SUPER_ADMIN") {
                console.warn(`[AUTH_BLOCK]: Estúdio suspenso - ${userCompany.slug}`);

                const errorBody = {
                  error: "BUSINESS_SUSPENDED",
                  message: "O acesso a este estúdio foi suspenso.",
                  // DADOS CRÍTICOS: Retornar o slug/nome do estúdio bloqueado para o Front exibir corretamente
                  slug: userCompany.slug,
                  name: userCompany.name,
                  businessId: userCompany.id
                };

                return new Response(JSON.stringify(errorBody), {
                  status: 403,
                  headers: new Headers({ "Content-Type": "application/json" }),
                });
              }

              // Cálculo de dias restantes (Trial)
              const now = new Date();
              let daysLeft = 0;
              if (userCompany.trialEndsAt) {
                const end = new Date(userCompany.trialEndsAt);
                const diffTime = end.getTime() - now.getTime();
                daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              }

              const companyData = {
                id: userCompany.id,
                name: userCompany.name,
                slug: userCompany.slug,
                subscriptionStatus: userCompany.subscriptionStatus,
                trialEndsAt: userCompany.trialEndsAt,
                daysLeft: daysLeft
              };

              // Injeta os dados no objeto
              if (data.user) {
                data.user.business = companyData;
                data.user.slug = userCompany.slug;
                data.user.businessId = userCompany.id;
              }
              if (data.session && data.session.user) {
                data.session.user.business = companyData;
                data.session.user.slug = userCompany.slug;
                data.session.user.businessId = userCompany.id;
              }

              console.log(`[AUTH_AFTER_HOOK] Enriquecido com sucesso: ${user.email} -> ${userCompany.slug}`);
            } else {
              console.log(`[AUTH_AFTER_HOOK] Nenhuma empresa encontrada para: ${user.email}`);
            }
          } catch (dbError) {
            console.error(`[AUTH_AFTER_HOOK] Erro ao buscar company:`, dbError);
          }
        }

        // Sempre retornamos uma Response com JSON e headers válidos
        const status = isResponseObject && response ? response.status : 200;
        const headers =
          isResponseObject && response && response.headers
            ? new Headers(response.headers)
            : new Headers({ "Content-Type": "application/json" });

        return new Response(JSON.stringify(data), {
          status,
          headers,
        });

      } catch (globalError) {
        console.error(`[AUTH_AFTER_HOOK] Erro crítico:`, globalError);
        return response || {};
      }
    },
  },
  plugins: [
    {
      id: "business-data",
      endpoints: {
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
                  aboutUs: schema.companySiteCustomizations.aboutUs,
                  appointmentFlow: schema.companySiteCustomizations.appointmentFlow,
                }
              })
              .from(schema.companies)
              .leftJoin(schema.companySiteCustomizations, eq(schema.companies.id, schema.companySiteCustomizations.companyId))
              .where(eq(schema.companies.ownerId, userId))
              .limit(1);

            const userCompany = results[0];

            let daysLeft = 0;
            if (userCompany && userCompany.trialEndsAt) {
              const now = new Date();
              const end = new Date(userCompany.trialEndsAt);
              const diffTime = end.getTime() - now.getTime();
              daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            }

            return ctx.json({
              business: userCompany ? { ...userCompany, daysLeft } : null,
              slug: userCompany?.slug || null,
            });
          }
        ),
      },
    },
  ],
});
