import { betterAuth } from "better-auth";
import { createAuthEndpoint } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../drizzle/database";
import * as schema from "../../../db/schema";
import { eq } from "drizzle-orm";

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET!,
  baseURL: process.env.BETTER_AUTH_URL!,
  trustedOrigins: [
    "http://localhost:3000",
    "http://localhost:3002",
    "http://lucas-studio.localhost:3000",
    "http://*.localhost:3000",
    "https://agendamento-nota-front.vercel.app",
    "https://agendamento-nota-backend.vercel.app",
    ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
    ...(process.env.PLATFORM_URL ? [process.env.PLATFORM_URL] : []),
  ],
  advanced: {
    crossSubDomainCookies: {
      enabled: true,
    },
    // No Vercel/Produção, useSecureCookies deve ser true para permitir SameSite=None
    useSecureCookies: process.env.NODE_ENV === "production",
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: schema,
  }),
  hooks: {
    before: async (context: any) => {
      const path = context.path || "";
      if (path.startsWith("/sign-in") || path.startsWith("/sign-up")) {
        const body = context.body || {};
        console.log(`\n[AUTH_DEBUG] Requisição em ${path}:`, body.email || "sem email");
      }
      return;
    },
    after: async (context: any) => {
      const path = context.path || "";

      // Tenta pegar a resposta do contexto original do Better-Auth
      // O Better-Auth v1+ espera que retornemos o objeto de resposta modificado ou o original.
      // Se retornarmos undefined, o middleware do Better-Auth pode crashar ao tentar acessar result.headers.
      let response = context.response || context.context?.returned;

      // Se for sign-out, retornamos a resposta original ou um objeto vazio seguro
      if (path.includes("/sign-out")) {
        console.log(`[AUTH_AFTER_HOOK] Processando sign-out para ${path}`);
        return response || context.response || {};
      }

      const isAuthPath =
        path.startsWith("/sign-in") ||
        path.startsWith("/sign-up") ||
        path.startsWith("/get-session");

      // Se não houver resposta ou não for um path de auth, retornamos o que temos
      if (!response || !isAuthPath) {
        return response || context.response || {};
      }

      // Se for um erro, não tentamos injetar dados de negócio
      if (response.error) {
        return response;
      }

      const user = response.user || response.session?.user;

      if (user && user.id) {
        try {
          const [userBusiness] = await db
            .select()
            .from(schema.business)
            .where(eq(schema.business.userId, user.id))
            .limit(1);

          if (userBusiness) {
            console.log(`[AUTH_AFTER_HOOK] Injetando business ${userBusiness.slug} para usuário ${user.id}`);
            // Injeta os dados do negócio no JSON de resposta
            if (response.user) {
              response.user.business = userBusiness;
              response.user.slug = userBusiness.slug;
            }
            if (response.session && response.session.user) {
              response.session.user.business = userBusiness;
              response.session.user.slug = userBusiness.slug;
            }
          } else {
            console.log(`[AUTH_AFTER_HOOK] Nenhum business encontrado para usuário ${user.id}`);
          }
        } catch (dbError) {
          console.error(`[AUTH_AFTER_HOOK] Erro ao buscar business:`, dbError);
        }
      }

      // SEMPRE retornar um objeto, nunca undefined
      return response || {};
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

            console.log(
              `[AUTH_PLUGIN] getBusiness chamado para usuário: ${session.user.id}`
            );
            const userId = session.user.id;
            const [userBusiness] = await db
              .select()
              .from(schema.business)
              .where(eq(schema.business.userId, userId))
              .limit(1);

            if (!userBusiness) {
              console.log(
                `[AUTH_PLUGIN] Nenhum negócio encontrado para o usuário: ${userId}`
              );
            }

            return ctx.json({
              business: userBusiness || null,
              slug: userBusiness?.slug || null,
            });
          }
        ),
      },
    },
  ],
  emailAndPassword: {
    enabled: true,
  },
});
