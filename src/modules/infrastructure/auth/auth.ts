import { betterAuth } from "better-auth";
import { createAuthEndpoint } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../drizzle/database";
import * as schema from "../../../db/schema";
import { eq } from "drizzle-orm";

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET!,
  emailAndPassword: {
    enabled: true,
  },
  // Prioriza a URL do Front (via Proxy) se disponível, para garantir cookies First-Party
  baseURL: process.env.FRONTEND_URL
    ? `${process.env.FRONTEND_URL}/api/auth`
    : (process.env.BETTER_AUTH_URL ? `${process.env.BETTER_AUTH_URL}/api/auth` : "http://localhost:3001/api/auth"),
  trustedOrigins: [
    "http://localhost:3000",
    "http://localhost:3001",
    "https://agendamento-nota-front.vercel.app",
    "https://landingpage-agendamento-front.vercel.app",
    ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
  ],
  advanced: {
    cookiePrefix: "better-auth",
    // Desabilitado: o proxy torna a comunicação First-Party
    crossSubDomainCookies: {
      enabled: false,
    },
    // No Vercel/Produção, useSecureCookies deve ser true para permitir SameSite=None
    // Em localhost, deve ser false a menos que use HTTPS
    useSecureCookies: process.env.NODE_ENV === "production",
    cookies: {
      sessionToken: {
        attributes: {
          sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
          secure: process.env.NODE_ENV === "production",
          httpOnly: true,
        },
      },
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

        // Fallback seguro para /get-session caso alguma etapa anterior falhe
        if (path.startsWith("/get-session")) {
          try {
            const hdrs: Headers =
              context.headers instanceof Headers
                ? context.headers
                : new Headers(context.headers || {});
            const cookie = hdrs.get("cookie") || "";
            const token = cookie
              .split(";")
              .map((c) => c.trim())
              .find((c) => c.startsWith("better-auth.sessionToken="))
              ?.split("=")[1];

            let payload: any = { user: null, session: null };
            if (token) {
              const [sess] = await db
                .select()
                .from(schema.session)
                .where(eq(schema.session.token, token))
                .limit(1);
              if (sess && sess.expiresAt > new Date()) {
                const [usr] = await db
                  .select()
                  .from(schema.user)
                  .where(eq(schema.user.id, sess.userId))
                  .limit(1);

                // BLOQUEIO EM TEMPO REAL: Se o usuário estiver desativado no banco
                if (usr && usr.active === false) {
                  console.warn(`[AUTH_GET_SESSION_BLOCK]: Conta desativada - ${usr.email}`);
                  return new Response(JSON.stringify({
                    error: "ACCOUNT_SUSPENDED",
                    message: "Sua conta foi desativada."
                  }), {
                    status: 403,
                    headers: new Headers({ "Content-Type": "application/json" }),
                  });
                }

                payload = {
                  session: sess,
                  user: usr || null,
                };
              }
            }

            // Se encontrou usuário, tenta enriquecer com business antes de retornar
            if (payload.user) {
              const businessResults = await db
                .select({
                  id: schema.companies.id,
                  name: schema.companies.name,
                  slug: schema.companies.slug,
                  active: schema.companies.active,
                })
                .from(schema.companies)
                .where(eq(schema.companies.ownerId, payload.user.id))
                .limit(1);

              const userCompany = businessResults[0];

              // LOG DE DEBUG PARA VALIDAR O QUE ESTÁ VINDO DO BANCO
              console.log(`[AUTH_DEBUG] User: ${payload.user.email} | Business Active: ${userCompany?.active}`);

              if (userCompany) {
                // BLOQUEIO EM TEMPO REAL: Se o estúdio estiver desativado no banco
                if (userCompany.active === false && payload.user.role !== "SUPER_ADMIN") {
                  console.warn(`[AUTH_GET_SESSION_BLOCK]: Estúdio suspenso - ${userCompany.slug}`);

                  // Forçamos a Response 403 aqui para o Better Auth não ignorar
                  const errorResponse = new Response(JSON.stringify({
                    error: "BUSINESS_SUSPENDED",
                    message: "O acesso a este estúdio foi suspenso."
                  }), {
                    status: 403,
                    headers: new Headers({
                      "Content-Type": "application/json",
                      "Access-Control-Allow-Origin": "http://localhost:3000",
                      "Access-Control-Allow-Credentials": "true"
                    }),
                  });

                  return errorResponse;
                }

                payload.user.business = userCompany;
                payload.user.slug = userCompany.slug;
                payload.user.businessId = userCompany.id;
              }
            }

            // Se chegamos aqui e temos um payload bloqueado por algum motivo
            // Mas para garantir o 403, retornamos a Response customizada
            return new Response(JSON.stringify(payload), {
              status: 200,
              headers: new Headers({ "Content-Type": "application/json" }),
            });
          } catch {
            // Se algo falhar, deixamos seguir fluxo padrão
          }
        }

        // Se for sign-out, garantimos um retorno JSON para evitar Unexpected EOF no front
        if (path.includes("/sign-out")) {
          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: new Headers({ "Content-Type": "application/json" })
          });
        }

        // Apenas processamos sucesso para caminhos de autenticação específicos
        const isAuthPath =
          path.startsWith("/sign-in") ||
          path.startsWith("/sign-up") ||
          path.startsWith("/get-session");

        if (!isAuthPath || !response) {
          return response;
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
            const results = await db
              .select({
                id: schema.companies.id,
                name: schema.companies.name,
                slug: schema.companies.slug,
                ownerId: schema.companies.ownerId,
              })
              .from(schema.companies)
              .where(eq(schema.companies.ownerId, user.id))
              .limit(1);

            const userCompany = results[0];

            if (userCompany) {
              const companyData = {
                id: userCompany.id,
                name: userCompany.name,
                slug: userCompany.slug,
              };

              // Injeta os dados no objeto
              if (data.user) {
                data.user.business = companyData;
                data.user.slug = userCompany.slug;
              }
              if (data.session && data.session.user) {
                data.session.user.business = companyData;
                data.session.user.slug = userCompany.slug;
              }

              console.log(`[AUTH_AFTER_HOOK] Enriquecido: ${user.email} -> ${userCompany.slug}`);
            }
          } catch (dbError) {
            console.error(`[AUTH_AFTER_HOOK] Erro ao buscar company:`, dbError);
          }
        }

        // Se era um Response, retorna um novo Response com os dados enriquecidos
        if (isResponseObject) {
          return new Response(JSON.stringify(data), {
            status: response.status,
            headers: new Headers(response.headers),
          });
        }

        return data;
      } catch (globalError) {
        console.error(`[AUTH_AFTER_HOOK] Erro crítico:`, globalError);
        return response;
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

            return ctx.json({
              business: userCompany || null,
              slug: userCompany?.slug || null,
            });
          }
        ),
      },
    },
  ],
});
