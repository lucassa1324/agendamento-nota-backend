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
    : (process.env.BETTER_AUTH_URL || "http://localhost:3000/api/auth"),
  trustedOrigins: [
    "http://localhost:3000",
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
    useSecureCookies: true,
    cookies: {
      sessionToken: {
        attributes: {
          sameSite: "lax",
          secure: true,
          httpOnly: true,
        },
      },
    },
  },
  session: {
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
                headers: { "Content-Type": "application/json" },
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
        // Se houver erro ou status >= 400, tratamos falhas de autenticação
        if (context.error || (response && response.status >= 400)) {
          if (path.includes("/sign-in")) {
            return new Response(JSON.stringify({
              error: context.error?.message || "Authentication failed",
              message: "Credenciais inválidas ou erro de autenticação"
            }), {
              status: 401,
              headers: new Headers({ "Content-Type": "application/json" })
            });
          }
          return response;
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
            const [userBusiness] = await db
              .select()
              .from(schema.business)
              .where(eq(schema.business.userId, user.id))
              .limit(1);

            if (userBusiness) {
              const businessData = {
                ...userBusiness,
                slug: userBusiness.slug
              };

              // Modifica o objeto response diretamente (se for um objeto plano)
              if (response.user) {
                response.user.business = businessData;
                response.user.slug = userBusiness.slug;
              }
              if (response.session && response.session.user) {
                response.session.user.business = businessData;
                response.session.user.slug = userBusiness.slug;
              }
            }
          } catch (dbError) {
            console.error(`[AUTH_AFTER_HOOK] Erro ao buscar business:`, dbError);
          }
        }

        // Importante: se response tiver headers, garantir que seja um objeto Headers
        // para evitar o erro "headers.forEach is not a function" no Better Auth interno
        if (response && response.headers && typeof response.headers.forEach !== 'function') {
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
            const [userBusiness] = await db
              .select()
              .from(schema.business)
              .where(eq(schema.business.userId, userId))
              .limit(1);

            return ctx.json({
              business: userBusiness || null,
              slug: userBusiness?.slug || null,
            });
          }
        ),
      },
    },
  ],
});
