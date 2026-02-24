import { betterAuth } from "better-auth";
import { createAuthEndpoint } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../drizzle/database";
import * as schema from "../../../db/schema";
import { and, eq } from "drizzle-orm";
import { verifyPassword as verifyScryptPassword } from "better-auth/crypto";

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

const detectHashAlgorithm = (hash: string) => {
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
  baseURL: baseURL, // RESTAURADO: baseURL deve apontar para o Proxy
  trustedOrigins: [
    "http://localhost:3000",
    "http://localhost:3001",
    "https://agendamento-nota-front.vercel.app",
    "https://landingpage-agendamento-front.vercel.app",
    ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
    ...(process.env.NEXT_PUBLIC_VERCEL_URL ? [`https://${process.env.NEXT_PUBLIC_VERCEL_URL}`] : []),
    ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
    "https://agendamento-nota-front.vercel.app/api-proxy", // Adicionado explicitamente o caminho do proxy
    "https://agendamento-nota-front-git-staging-lucassa1324s-projects.vercel.app", // Staging Environment
    "https://agendamento-nota-front-git-staging-lucassa1324s-projects.vercel.app/api-proxy" // Staging Proxy
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
                  socialLinks: schema.companySiteCustomizations.socialLinks,
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
