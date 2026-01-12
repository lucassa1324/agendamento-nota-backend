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
    "https://agendamento-nota-front.vercel.app",
    "http://localhost:3000",
    "http://localhost:3002",
    "http://lucas-studio.localhost:3000",
    "http://*.localhost:3000",
    "https://agendamento-nota-backend.vercel.app",
    "https://*.vercel.app",
    ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
    ...(process.env.PLATFORM_URL ? [process.env.PLATFORM_URL] : []),
  ],
  advanced: {
    cookiePrefix: "better-auth",
    useHeader: true, // Habilita o uso do header Authorization: Bearer <token>
    crossSubDomainCookies: {
      enabled: true,
    },
    // No Vercel/Produção, useSecureCookies deve ser true para permitir SameSite=None
    useSecureCookies: process.env.NODE_ENV === "production",
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

      // Log de depuração de entrada conforme solicitado
      const authHeader = context.headers?.get("authorization");
      console.log(`>>> [BACKEND] Requisição em ${path} | Header Authorization recebido:`, authHeader ? "SIM" : "NÃO");

      // Verificação crítica de segredo e banco de dados
      const secret = process.env.BETTER_AUTH_SECRET || "";
      const dbUrl = process.env.DATABASE_URL || "";

      console.log(`>>> [CRITICAL_DEBUG] BETTER_AUTH_SECRET (prefixo): ${secret.substring(0, 4)}**** (Tamanho: ${secret.length})`);
      console.log(`>>> [CRITICAL_DEBUG] DATABASE_URL (destino): ${dbUrl.includes("supabase") ? "SUPABASE DETECTADO" : "OUTRO BANCO"} | Prefixo: ${dbUrl.substring(0, 15)}...`);

      // Log de depuração para tokens recebidos
      if (path.includes("/get-session")) {
        const token = authHeader || "AUSENTE";
        console.log(`[AUTH_DEBUG] get-session iniciado - Token bruto: ${token.substring(0, 30)}...`);

        if (!authHeader) {
          console.warn(">>> [AUTH_DEBUG] AVISO: Header Authorization está faltando na requisição do Front-end!");
        }
      }

      // Proteção contra 500 no sign-out se não houver sessão
      if (path.includes("/sign-out")) {
        try {
          const session = await auth.api.getSession({
            headers: context.headers,
          });

          if (!session) {
            console.log(`[AUTH_BEFORE_HOOK] Sign-out ignorado: nenhuma sessão ativa`);
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

      if (path.startsWith("/sign-in") || path.startsWith("/sign-up")) {
        const body = context.body || {};
        console.log(`\n[AUTH_DEBUG] Tentativa de login/registro em ${path}:`, body.email || "sem email");
      }
      return;
    },
    after: async (context: any) => {
      const path = context.path || "";
      const startTime = Date.now();
      let response;

      try {
        // Tenta capturar a resposta de forma segura
        response = context.response || context.context?.returned;

        // Log de início do processamento after
        if (path.includes("/get-session")) {
          console.log(`[AUTH_AFTER_HOOK] Processando resposta para ${path}...`);
        }

        // Se for um erro de autenticação (ex: senha errada), o Better-Auth pode retornar status 401 ou 403
        // Capturamos isso para evitar que o servidor quebre ao tentar processar o JSON
        if (context.error || (response && (response.error || response.status >= 400))) {
          const status = response?.status || 401;
          const errorMsg = response?.error || "Authentication failed";
          console.log(`[AUTH_AFTER_HOOK] Erro detectado em ${path} (Status ${status}):`, errorMsg);

          // Se for uma falha de login, retornamos um erro formatado em vez de deixar o servidor dar 500
          if (path.includes("/sign-in")) {
            return new Response(JSON.stringify({
              error: errorMsg,
              message: "Credenciais inválidas ou erro de autenticação"
            }), {
              status: 401,
              headers: { "Content-Type": "application/json" }
            });
          }
          return response;
        }

        // Se for sign-out, garantimos um retorno JSON para evitar Unexpected EOF
        if (path.includes("/sign-out")) {
          console.log(`[AUTH_AFTER_HOOK] Sign-out processado para ${path}`);
          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
          });
        }

        const isAuthPath =
          path.startsWith("/sign-in") ||
          path.startsWith("/sign-up") ||
          path.startsWith("/get-session");

        if (!response || !isAuthPath) {
          return response || {};
        }

        const user = response.user || response.session?.user;

        if (user && user.id) {
          try {
            if (path.includes("/get-session")) console.log(`[AUTH_AFTER_HOOK] Buscando business para usuário ${user.id}...`);

            const [userBusiness] = await db
              .select()
              .from(schema.business)
              .where(eq(schema.business.userId, user.id))
              .limit(1);

            if (userBusiness) {
              if (path.includes("/get-session")) console.log(`[AUTH_AFTER_HOOK] Business encontrado: ${userBusiness.slug}`);

              const businessData = {
                ...userBusiness,
                slug: userBusiness.slug
              };

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
            console.error(`[AUTH_AFTER_HOOK] Erro ao buscar business no banco:`, dbError);
          }
        }

        if (path.includes("/get-session")) {
          const duration = Date.now() - startTime;
          console.log(`>>> [BACKEND] Sessão enviada com sucesso para o Front (Duração: ${duration}ms)`);
        }

        return response;
      } catch (globalError) {
        console.error(`[AUTH_AFTER_HOOK] CRITICAL ERROR em ${path}:`, globalError);
        // Fallback para evitar 500 total
        return response || new Response(JSON.stringify({ error: "Internal Server Error during auth hook" }), { status: 500 });
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
  // Estrutura correta para habilitar Bearer Token na versão 1.x
  secondaryStorage: {
    get: async (key) => {
      return null;
    },
    set: async (key, value, expiration) => { },
    delete: async (key) => { },
  },
});
