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
      enabled: process.env.NODE_ENV === "production",
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
          domain: process.env.NODE_ENV === "production" ? ".vercel.app" : undefined,
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
  hooks: {
    before: async (context: any) => {
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
      const response = context.response || context.context?.returned;

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
                payload = {
                  session: sess,
                  user: usr || null,
                };
              }
            }

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

        // Se chegamos aqui, é um sucesso em um caminho de auth. 
        // Vamos enriquecer o objeto user com os dados do business.
        const user = response.user || response.session?.user;

        if (user && user.id) {
          try {
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
              .where(eq(schema.companies.ownerId, user.id))
              .limit(1);

            const userCompany = results[0];

            if (userCompany) {
              const companyData = {
                ...userCompany,
                slug: userCompany.slug
              };

              // Modifica o objeto response diretamente (se for um objeto plano)
              if (response.user) {
                response.user.business = companyData;
                response.user.slug = userCompany.slug;
              }
              if (response.session && response.session.user) {
                response.session.user.business = companyData;
                response.session.user.slug = userCompany.slug;
              }
            }
          } catch (dbError) {
            console.error(`[AUTH_AFTER_HOOK] Erro ao buscar company:`, dbError);
          }
        }

        // Importante: se response tiver headers, garantir que seja um objeto Headers
        // para evitar o erro "headers.forEach is not a function" no Better Auth interno
        if (response && response.headers && !(response.headers instanceof Headers)) {
          try {
            response.headers = new Headers(response.headers);
          } catch (e) {
            // Se falhar (ex: response é um Response objeto read-only), ignoramos
          }
        }

        return response;
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
