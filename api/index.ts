// Imports estáticos (ESM) - necessário para o bundler da Vercel detectar todos os módulos
import { Elysia } from "elysia";
import { auth } from "../src/modules/infrastructure/auth/auth";
import { authPlugin } from "../src/modules/infrastructure/auth/auth-plugin";
import { repositoriesPlugin } from "../src/modules/infrastructure/di/repositories.plugin";

// Controllers
import { userController } from "../src/modules/user/adapters/in/http/user.controller";
import { businessController } from "../src/modules/business/adapters/in/http/business.controller";
import { serviceController } from "../src/modules/services/adapters/in/http/service.controller";
import { reportController } from "../src/modules/reports/adapters/in/http/report.controller";
import { appointmentController } from "../src/modules/appointments/adapters/in/http/appointment.controller";
import { staffController } from "../src/modules/staff/adapters/in/http/staff.controller";
import { settingsController } from "../src/modules/settings/adapters/in/http/settings.controller";
import { inventoryController } from "../src/modules/inventory/adapters/in/http/inventory.controller";
import { expenseController } from "../src/modules/expenses/adapters/in/http/expense.controller";
import { masterAdminController } from "../src/modules/business/adapters/in/http/master-admin.controller";
import { galleryController } from "../src/modules/gallery/adapters/in/http/gallery.controller";
import { storageController } from "../src/modules/infrastructure/storage/storage.controller";
import { notificationsController } from "../src/modules/notifications/adapters/in/http/notifications.controller";
import { pushController } from "../src/modules/notifications/adapters/in/http/push.controller";
import { userPreferencesController } from "../src/modules/user/adapters/in/http/user-preferences.controller";
import { paymentController } from "../src/modules/infrastructure/payment/payment.controller";
import { asaasWebhookController } from "../src/modules/infrastructure/payment/asaas.webhook.controller";
import { billingController } from "../src/modules/billing/adapters/in/http/billing.controller";
import { DNSController } from "../src/modules/dns/infrastructure/adapters/in/http/dns.controller";

// Utils e DB
import { db } from "../src/modules/infrastructure/drizzle/database";
import * as schema from "../src/db/schema";
import { eq, and, count, ilike } from "drizzle-orm";
import { calculateAnchoredNextBillingDate, resolveBillingAnchorDay } from "../src/modules/infrastructure/payment/billing-dates";
import { uploadToB2 } from "../src/modules/infrastructure/storage/b2.storage";

console.log("[STARTUP] Preparando handler para Vercel (Bun)");

const app = new Elysia({
  name: 'AgendamentoNota',
  prefix: "/api"
})
  .get("/email-verified", async ({ query, set }) => {
    const { token, callbackURL } = query;
    const frontendBaseUrl =
      process.env.FRONTEND_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "https://agendamento-nota-front.vercel.app";

    const resolveFrontendCallbackUrl = (rawUrl?: string) => {
      if (!rawUrl || rawUrl.trim() === "") {
        return `${frontendBaseUrl}/admin/email-verified`;
      }
      if (/^https?:\/\//i.test(rawUrl)) {
        return rawUrl;
      }
      const normalizedPath = rawUrl.startsWith("/") ? rawUrl : `/${rawUrl}`;
      return `${frontendBaseUrl}${normalizedPath}`;
    };

    const frontendUrl = resolveFrontendCallbackUrl(callbackURL as string | undefined);

    if (!token) {
      console.log("[VERIFY_EMAIL] Chamado sem token, redirecionando para callbackURL ou fallback.");
      const redirectUrl = frontendUrl.includes('?') ? `${frontendUrl}&verified=true` : `${frontendUrl}?verified=true`;
      return Response.redirect(redirectUrl, 302);
    }

    try {
      console.log(`[VERIFY_EMAIL] Iniciando verificação para token: ${token}`);
      await auth.api.verifyEmail({
        query: {
          token,
          callbackURL: frontendUrl
        }
      });
      console.log(`[VERIFY_EMAIL] Sucesso! Redirecionando para: ${frontendUrl}`);
      const redirectUrl = frontendUrl.includes('?') ? `${frontendUrl}&verified=true` : `${frontendUrl}?verified=true`;
      return Response.redirect(redirectUrl, 302);
    } catch (e) {
      console.error("[VERIFY_EMAIL_ERROR]", e);
      const errorUrl = frontendUrl.includes('?') ? `${frontendUrl}&error=verification_failed` : `${frontendUrl}?error=verification_failed`;
      return Response.redirect(errorUrl, 302);
    }
  })
  .all("/auth/*", async (ctx) => {
    console.log(`>>> [AUTH_HANDLER] ${ctx.request.method} ${ctx.path}`);
    try {
      if (ctx.request.method === "GET" && (ctx.path === "/auth/session" || ctx.path === "/auth/get-session")) {
        let sessionData: unknown = null;
        try {
          sessionData = await auth.api.getSession({
            headers: ctx.request.headers,
          });
        } catch (sessionError: any) {
          console.warn(`>>> [AUTH_SESSION_FALLBACK] getSession falhou (${sessionError?.message || "erro desconhecido"}). Retornando null.`);
          sessionData = null;
        }
        return new Response(JSON.stringify(sessionData || null), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
            Pragma: "no-cache",
            Expires: "0",
          },
        });
      }

      const response = await auth.handler(ctx.request);
      console.log(`<<< [AUTH_HANDLER] Status: ${response.status}`);
      
      if (!response) {
        console.error("<<< [AUTH_HANDLER_END] Better Auth retornou resposta vazia");
        return new Response(JSON.stringify({ error: "Internal Auth Error" }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }

      if (response.status >= 400) {
        try {
          const clonedRes = response.clone();
          const errorText = await clonedRes.text();
          console.error(`<<< [AUTH_ERROR_DETAILS] ${errorText}`);
        } catch (e) {
          console.error("<<< [AUTH_ERROR_DETAILS_FAILED] Erro ao ler corpo do erro");
        }
      }

      const responseBody = response.body ? response.body : JSON.stringify({});
      const newResponse = new Response(responseBody, {
        status: response.status,
        statusText: response.statusText,
        headers: new Headers(response.headers)
      });

      const origin = ctx.request.headers.get("origin");
      if (origin) {
        newResponse.headers.set("Access-Control-Allow-Origin", origin);
        newResponse.headers.set("Access-Control-Allow-Credentials", "true");
        newResponse.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
        newResponse.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, Cookie, X-Requested-With, Cache-Control");
      }

      if (ctx.path.endsWith("/sign-out") || ctx.path.endsWith("/logout")) {
        console.log("[LOGOUT] Limpando cookie better-auth.session_token");
        newResponse.headers.set("Set-Cookie", "better-auth.session_token=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax");
      }

      return newResponse;
    } catch (e: any) {
      console.error(`!!! [AUTH_HANDLER_ERROR] ${e.message}`, e.stack);
      return new Response(
        JSON.stringify({ error: "Auth handler failure", message: e?.message || "unknown" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  })
  .onRequest(({ request, set }) => {
    const url = new URL(request.url);
    if (!url.pathname.includes("/auth/session")) {
      console.log(`>>> [RECEIVE] ${request.method} ${url.pathname}`);
    }
    if (request.method === "OPTIONS") {
      const origin = request.headers.get("origin");
      const allowedOrigins = [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:3002',
        'http://127.0.0.1:3000',
        'https://app.aurasistema.com.br',
        'https://aurasistema.com.br',
        'https://app.staging.aurasistema.com.br'
      ];
      const isAllowed = allowedOrigins.includes(origin!) ||
        (origin && origin.match(/^http:\/\/.*\.localhost:\d+$/)) ||
        (origin && (origin.endsWith('.aurasistema.com.br') || origin === 'https://aurasistema.com.br')) ||
        (origin && origin.endsWith('.vercel.app'));
      if (isAllowed && origin) {
        return new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
            "Access-Control-Allow-Headers": "Content-Type, Authorization, Cookie, X-Requested-With, Cache-Control",
            "Access-Control-Max-Age": "86400",
          }
        });
      }
    }
  })
  .onBeforeHandle(({ request, set }) => {
    const origin = request.headers.get("origin");
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      'http://127.0.0.1:3000',
      'https://app.aurasistema.com.br',
      'https://aurasistema.com.br',
      'https://app.staging.aurasistema.com.br'
    ];
    const isAllowed = allowedOrigins.includes(origin!) ||
      (origin && origin.match(/^http:\/\/.*\.localhost:\d+$/)) ||
      (origin && (origin.endsWith('.aurasistema.com.br') || origin === 'https://aurasistema.com.br')) ||
      (origin && origin.endsWith('.vercel.app'));
    if (isAllowed && origin) {
      set.headers["Access-Control-Allow-Origin"] = origin;
      set.headers["Access-Control-Allow-Credentials"] = "true";
      set.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH";
      set.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, Cookie, X-Requested-With, Cache-Control";
      set.headers["Access-Control-Expose-Headers"] = "Set-Cookie, set-cookie, Authorization, Cache-Control";
    }
    set.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, proxy-revalidate";
    set.headers["Pragma"] = "no-cache";
    set.headers["Expires"] = "0";
  })
  .use(authPlugin)
  .use(repositoriesPlugin)
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
  .use(DNSController())
  .group("/api", (api) =>
    api
      .post("/feedback", async ({ body, user, set, request }) => {
        try {
          const payload = body as {
            type?: "bug" | "suggestion";
            description?: string;
            screenshot?: string;
            url?: string;
            userAgent?: string;
            metadata?: Record<string, unknown>;
          };
          const feedbackType = payload?.type?.toLowerCase() === "suggestion" ? "SUGGESTION" : "BUG";
          if (!payload?.description?.trim()) {
            set.status = 400;
            return { error: "Descrição é obrigatória." };
          }
          if (feedbackType === "BUG" && !payload?.screenshot) {
            set.status = 400;
            return { error: "Screenshot é obrigatória para relatório de bug." };
          }
          let screenshotUrl: string | null = null;
          const pageUrl = payload.url || "";
          let companyId: string | null = null;
          if (pageUrl) {
            try {
              const parsedUrl = new URL(pageUrl);
              const segments = parsedUrl.pathname.split("/").map(s => s.trim()).filter(Boolean);
              const blockedSlugs = new Set(["admin", "api", "dashboard", "master"]);
              const maybeSlug = segments.find(s => !blockedSlugs.has(s.toLowerCase()));
              if (maybeSlug) {
                const [company] = await db.select({ id: schema.companies.id }).from(schema.companies).where(eq(schema.companies.slug, maybeSlug.toLowerCase())).limit(1);
                companyId = company?.id || null;
              }
            } catch {}
          }
          if (payload.screenshot) {
            const matches = payload.screenshot.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
            if (!matches || !matches[1] || !matches[2]) {
              set.status = 400;
              return { error: "Formato de screenshot inválido." };
            }
            const contentType = matches[1];
            const base64Data = matches[2];
            const extensionMap: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/jpg": "jpg", "image/webp": "webp" };
            const extension = extensionMap[contentType] || "png";
            const screenshotBuffer = Buffer.from(base64Data, "base64");
            const key = `feedback/${feedbackType.toLowerCase()}/${companyId || "unknown"}/${crypto.randomUUID()}.${extension}`;
            screenshotUrl = await uploadToB2({ buffer: screenshotBuffer, contentType, key, cacheControl: "public, max-age=31536000" });
          }
          const forwardedFor = request.headers.get("x-forwarded-for");
          const realIp = request.headers.get("x-real-ip");
          const ipAddress = forwardedFor?.split(",")[0]?.trim() || realIp || null;
          const acceptLanguage = request.headers.get("accept-language");
          const clientMetadata = payload.metadata && typeof payload.metadata === "object" ? payload.metadata : {};
          const metadata = { ...clientMetadata, requestHost: request.headers.get("host"), requestOrigin: request.headers.get("origin"), requestReferer: request.headers.get("referer"), secChUa: request.headers.get("sec-ch-ua"), secChUaMobile: request.headers.get("sec-ch-ua-mobile"), secChUaPlatform: request.headers.get("sec-ch-ua-platform"), submittedAtServer: new Date().toISOString() };
          const [created] = await db.insert(schema.bugReports).values({ id: crypto.randomUUID(), reporterUserId: user?.id || null, companyId, type: feedbackType, description: payload.description.trim(), screenshotUrl, pageUrl: pageUrl || "", userAgent: payload.userAgent || null, ipAddress, acceptLanguage, metadata, status: "NEW", createdAt: new Date(), updatedAt: new Date() }).returning({ id: schema.bugReports.id });
          return { success: true, id: created?.id, type: feedbackType, screenshotUrl };
        } catch (error: any) {
          console.error("[BUG_REPORT_CREATE_ERROR]:", error);
          set.status = 500;
          return { error: "Falha ao registrar feedback.", message: error?.message || "Erro interno." };
        }
      })
      .group("/account", (account) =>
        account
          .onBeforeHandle(({ user, set }) => {
            if (!user) { set.status = 401; return { error: "Unauthorized" }; }
          })
          .patch("/complete-onboarding", async ({ user }) => {
            await db.update(schema.user).set({ hasCompletedOnboarding: true }).where(eq(schema.user.id, user!.id));
            return { success: true };
          })
          .post("/cancel-feedback", async ({ user, body, set }) => {
            const { reason, details, customReason } = body as { reason: string; details?: string; customReason?: string };
            if (!reason) { set.status = 422; return { error: "Missing reason" }; }
            await db.insert(schema.accountCancellationFeedback).values({ id: crypto.randomUUID(), userId: user!.id, reason, details: customReason || details || null, createdAt: new Date() });
            return { success: true };
          })
          .get("/cancellation-offer", async () => {
            const [currentUser] = await db.select({ lastRetentionDiscountAt: schema.user.lastRetentionDiscountAt }).from(schema.user).where(eq(schema.user.id, user!.id)).limit(1);
            const last = currentUser?.lastRetentionDiscountAt ? new Date(currentUser.lastRetentionDiscountAt) : null;
            const now = new Date();
            let available = true;
            let nextEligibleAt: Date | null = null;
            if (last) {
              const nextEligible = new Date(last);
              nextEligible.setMonth(nextEligible.getMonth() + 12);
              if (nextEligible > now) { available = false; nextEligibleAt = nextEligible; }
            }
            if (!available) return { available: false, nextEligibleAt };
            return { available: true, offer: { type: "RETENTION_20_3M", percentage: 20, durationMonths: 3 } };
          })
          .get("/system-announcement", async () => {
            try {
              const [announcement] = await db.select().from(schema.systemSettings).where(eq(schema.systemSettings.key, "global_announcement")).limit(1);
              return { message: announcement?.value || null, updatedAt: announcement?.updatedAt || null };
            } catch { return { message: null }; }
          })
          .post("/accept-offer", async ({ user, body }) => {
            const { subscriptionId } = body as { subscriptionId?: string };
            let resolvedSubscriptionId = subscriptionId;
            if (!resolvedSubscriptionId) {
              const [company] = await db.select({ asaasSubscriptionId: schema.companies.asaasSubscriptionId }).from(schema.companies).where(eq(schema.companies.ownerId, user!.id)).limit(1);
              resolvedSubscriptionId = company?.asaasSubscriptionId || undefined;
            }
            await db.update(schema.user).set({ lastRetentionDiscountAt: new Date(), accountStatus: "ACTIVE", cancellationRequestedAt: null, retentionEndsAt: null }).where(eq(schema.user.id, user!.id));
            if (resolvedSubscriptionId) {
              try {
                await asaas.applyDiscount(resolvedSubscriptionId, { percentage: 20, cycles: 3 });
              } catch (error: any) {
                console.error("[ACCEPT_OFFER_DISCOUNT_ERROR]", error);
                return { success: true, warning: "Oferta aceita localmente, mas houve falha ao aplicar desconto no Asaas.", detail: error?.message || "Erro desconhecido" };
              }
            }
            return { success: true, message: "Desconto aplicado com sucesso! Obrigado por continuar conosco." };
          })
          .post("/terminate", async ({ user, body }) => {
            const { subscriptionId } = body as { subscriptionId?: string };
            const [currentUser] = await db.select({ createdAt: schema.user.createdAt }).from(schema.user).where(eq(schema.user.id, user!.id)).limit(1);
            const [currentCompany] = await db.select({ id: schema.companies.id, firstSubscriptionAt: schema.companies.firstSubscriptionAt, billingAnchorDay: schema.companies.billingAnchorDay, asaasSubscriptionId: schema.companies.asaasSubscriptionId }).from(schema.companies).where(eq(schema.companies.ownerId, user!.id)).limit(1);
            const now = new Date();
            const accountCreatedAt = currentUser?.createdAt ? new Date(currentUser.createdAt) : now;
            const firstSubscriptionAt = currentCompany?.firstSubscriptionAt ? new Date(currentCompany.firstSubscriptionAt) : null;
            const refundBaseDate = firstSubscriptionAt || accountCreatedAt;
            const diffInMs = now.getTime() - refundBaseDate.getTime();
            const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
            const eligibleFullRefund = diffInDays <= 7;
            const refundPolicyMessage = eligibleFullRefund ? "Cancelamento na primeira assinatura dentro de 7 dias: elegível a reembolso total." : "Cancelamento fora da janela da primeira assinatura: não há reembolso automático.";
            const resolvedSubscriptionId = subscriptionId || currentCompany?.asaasSubscriptionId || undefined;
            const accessUntil = calculateAnchoredNextBillingDate(now, resolveBillingAnchorDay(currentCompany?.billingAnchorDay));
            if (resolvedSubscriptionId) {
              await asaas.cancelSubscription(resolvedSubscriptionId);
              if (eligibleFullRefund) {
                try {
                  console.log(`[TERMINATE] Usuário ${user!.id} elegível para reembolso total. Buscando pagamentos da assinatura ${resolvedSubscriptionId}...`);
                  const payments = await asaas.listSubscriptionPayments(resolvedSubscriptionId);
                  const refundablePayments = payments.filter((p: any) => p.status === "CONFIRMED" || p.status === "RECEIVED");
                  if (refundablePayments.length > 0) {
                    const latestPayment = refundablePayments.sort((a: any, b: any) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime())[0];
                    console.log(`[TERMINATE] Iniciando estorno do pagamento ${latestPayment.id} para usuário ${user!.id}`);
                    await asaas.refundPayment(latestPayment.id);
                  } else {
                    console.warn(`[TERMINATE] Nenhum pagamento confirmado encontrado para reembolso da assinatura ${resolvedSubscriptionId}`);
                  }
                } catch (refundError) {
                  console.error("[TERMINATE_REFUND_ERROR] Erro ao processar estorno automático:", refundError);
                }
              }
            }
            const retentionEndsAt = new Date(now);
            retentionEndsAt.setDate(retentionEndsAt.getDate() + 365);
            await db.update(schema.user).set({ accountStatus: "PENDING_CANCELLATION", active: !eligibleFullRefund, cancellationRequestedAt: now, retentionEndsAt }).where(eq(schema.user.id, user!.id));
            if (currentCompany?.id) {
              await db.update(schema.companies).set({ subscriptionStatus: eligibleFullRefund ? "canceled" : "pending_cancellation", active: !eligibleFullRefund, trialEndsAt: eligibleFullRefund ? now : accessUntil, billingGraceEndsAt: null, blockedAt: eligibleFullRefund ? now : null, updatedAt: now }).where(eq(schema.companies.id, currentCompany.id));
            }
            return { success: true, status: eligibleFullRefund ? "CANCELED" : "PENDING_CANCELLATION", retentionEndsAt, message: eligibleFullRefund ? "Cancelamento concluído com estorno automático da primeira assinatura." : `Cancelamento agendado. Seu acesso permanece ativo até ${accessUntil.toLocaleDateString("pt-BR")}.`, accessUntil, refundPolicy: { eligibleFullRefund, daysSinceRefundBase: diffInDays, firstSubscriptionAt, message: refundPolicyMessage } };
          })
      )
  )
  .get("/", () => {
    const urlHint = process.env.BETTER_AUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
    return `🦊 Elysia está rodando em ${urlHint}`;
  })
  .get("/test-error", () => { throw new Error("Test error for logs"); })
  .get("/api/health", async () => {
    try {
      await db.execute(sql`select 1`);
      console.log("[HEALTH_CHECK] Hitting health endpoint - SUCCESS (DB Connected)");
      return { status: "ok", database: "connected", timestamp: new Date().toISOString(), version: "V2-VERCEL" };
    } catch (e) {
      console.error("[HEALTH_CHECK] DB Connection failed:", e);
      return { status: "error", database: "disconnected", error: String(e), timestamp: new Date().toISOString() };
    }
  })
  .get("/get-session", ({ set }) => { set.redirect = "/auth/get-session"; })
  .post("/sign-in/*", ({ path, set }) => { set.redirect = `/auth${path}`; })
  .post("/sign-out", ({ set }) => { set.redirect = "/auth/sign-out"; })
  .get("/auth/session", ({ set }) => { set.redirect = "/auth/get-session"; })
  .get("/session", ({ set }) => { set.redirect = "/auth/get-session"; })
  .get("/api/proxy/auth/session", ({ set }) => { set.redirect = "/auth/get-session"; })
  .get("/proxy/session", ({ set }) => { set.redirect = "/auth/get-session"; })
  .get("/api/test-error", () => { throw new Error("Test error for logs"); })
  .onError(({ code, error, request }) => {
    console.error(`\n[ERROR_GLOBAL] ${request.method} ${request.url} ${code}:`, error);
    if (error instanceof Error) console.error("Stack Trace:", error.stack);
    return { error: "INTERNAL_SERVER_ERROR", message: error.message, code, stack: process.env.NODE_ENV === "development" ? error.stack : undefined };
  });

console.log("[STARTUP] Servidor configurado com sucesso.");
const urlHint = process.env.BETTER_AUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
console.log(`🦊 Elysia configurado com sucesso em ${urlHint}`);

// Handler para Vercel Serverless
export default async function handler(request: Request) {
  if (!process.env.DATABASE_URL) {
    console.error("[HANDLER] FATAL: DATABASE_URL IS MISSING");
    return new Response(JSON.stringify({ error: "DATABASE_URL_IS_MISSING" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
  if (!process.env.BETTER_AUTH_SECRET) {
    console.warn("[HANDLER] WARNING: BETTER_AUTH_SECRET IS MISSING");
  }
  return await app.fetch(request);
}
