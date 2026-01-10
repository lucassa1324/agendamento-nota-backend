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
    ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
    ...(process.env.PLATFORM_URL ? [process.env.PLATFORM_URL] : []),
  ],
  advanced: {
    crossSubDomainCookies: {
      enabled: true,
    },
    useSecureCookies: false,
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
      if (path.startsWith("/sign-in")) {
        const body = context.body || {};
        console.log(`\n[AUTH_DEBUG] Tentativa de login iniciada:`);
        console.log(`> E-mail: ${body.email}`);
        console.log(`> Path: ${path}`);

        // Verificar se o usuário existe no banco
        if (body.email) {
          const existingUser = await db
            .select()
            .from(schema.user)
            .where(eq(schema.user.email, body.email))
            .limit(1);

          if (existingUser.length === 0) {
            console.warn(`[AUTH_DEBUG] AVISO: Usuário com e-mail ${body.email} NÃO encontrado no banco.`);
          } else {
            console.log(`[AUTH_DEBUG] Usuário encontrado no banco. ID: ${existingUser[0].id}`);

            // Verificar se tem conta vinculada
            const userAccount = await db
              .select()
              .from(schema.account)
              .where(eq(schema.account.userId, existingUser[0].id))
              .limit(1);

            if (userAccount.length === 0) {
              console.warn(`[AUTH_DEBUG] AVISO: Usuário encontrado, mas NÃO possui conta vinculada na tabela 'account'.`);
            } else {
              console.log(`[AUTH_DEBUG] Conta encontrada para o usuário. Provedor: ${userAccount[0].providerId}`);
            }
          }
        }
      }
      return;
    },
    after: async (context: any) => {
      const path = context.path || "";

      // No Better-Auth v1 + Elysia, o objeto retornado (user, session, etc) 
      // fica em context.context.returned
      const response = context.response || context.context?.returned || {};

      const isAuthPath =
        path.startsWith("/sign-in") ||
        path.startsWith("/sign-up") ||
        path.startsWith("/get-session");

      if (!isAuthPath) {
        return response;
      }

      // Log de resultado para sign-in
      if (path.startsWith("/sign-in")) {
        if (response.error) {
          console.error(`[AUTH_DEBUG] Falha no login:`, response.error);
        } else {
          const user = response.user || response.session?.user;
          if (user) {
            console.log(`[AUTH_DEBUG] Login bem-sucedido para: ${user.email}`);
          }
        }
      }

      if (response.error) {
        return response;
      }

      const user = response.user || response.session?.user;

      if (user && user.id) {
        const [userBusiness] = await db
          .select()
          .from(schema.business)
          .where(eq(schema.business.userId, user.id))
          .limit(1);

        if (userBusiness) {
          // Injeta os dados do negócio no JSON de resposta
          if (response.user) {
            response.user.business = userBusiness;
            response.user.slug = userBusiness.slug;
          }
          if (response.session && response.session.user) {
            response.session.user.business = userBusiness;
            response.session.user.slug = userBusiness.slug;
          }
        }
      }

      return response;
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
