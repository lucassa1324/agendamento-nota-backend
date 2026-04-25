import { Elysia } from "elysia";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "../drizzle/database";
import * as schema from "../../../db/schema";
import { and, eq } from "drizzle-orm";
import { auth } from "./auth";
import {
    calculateAnchoredNextBillingDate,
    resolveBillingAnchorDay,
} from "../payment/billing-dates";

export type User = typeof auth.$Infer.Session.user & {
    business?: any;
    slug?: string;
    businessId?: string;
    role?: string;
    active?: boolean;
};

export type Session = typeof auth.$Infer.Session.session;

const normalizeEnvValue = (value?: string) =>
    value?.trim().replace(/^['"]|['"]$/g, "") || "";

const extractEnvValueFromContent = (content: string, key: string) => {
    const regex = new RegExp(`^${key}=(.*)$`, "m");
    const match = content.match(regex);
    if (!match?.[1]) {
        return "";
    }
    return normalizeEnvValue(match[1]);
};

const readEnvFallback = async (key: string) => {
    const candidates = [
        path.join(process.cwd(), ".env"),
        path.join(process.cwd(), ".env.local"),
        path.join(process.cwd(), "back_end", ".env"),
        path.join(process.cwd(), "back_end", ".env.local"),
        path.join(process.cwd(), "front_end", ".env.local"),
        path.join(process.cwd(), "..", "back_end", ".env"),
        path.join(process.cwd(), "..", "back_end", ".env.local"),
        path.join(process.cwd(), "..", "front_end", ".env.local"),
    ];

    for (const envPath of candidates) {
        try {
            const content = await readFile(envPath, "utf8");
            const value = extractEnvValueFromContent(content, key);
            if (value) {
                return value;
            }
        } catch { }
    }

    return "";
};

// Cache para evitar múltiplas sincronizações simultâneas para a mesma empresa
const syncCache = new Map<string, { promise: Promise<any>, timestamp: number }>();
const SYNC_CACHE_TTL = 30000; // 30 segundos de cache para o resultado da sincronização

const paidStatuses = ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"];
const ACTIVATION_WINDOW_DAYS = 60;
const BILLING_GRACE_DAYS = 7;
const RENEWAL_SYNC_WINDOW_DAYS = 3;
type BillingAuditDecision = "ACTIVE" | "GRACE" | "BLOCKED";

const isTruthy = (value?: string) => {
    if (!value) return false;
    const normalized = String(value).trim().toLowerCase();
    return ["1", "true", "yes", "on"].includes(normalized);
};

const logBillingAudit = (
    enabled: boolean,
    payload: {
        companyId?: string;
        slug?: string;
        userId?: string;
        userEmail?: string;
        beforeStatus?: string | null;
        afterStatus?: string | null;
        beforeActive?: boolean | null;
        afterActive?: boolean | null;
        decision: BillingAuditDecision;
        reason: string;
    },
) => {
    if (!enabled) return;
    console.log(
        `[BILLING_AUDIT] company=${payload.companyId || "n/a"} slug=${payload.slug || "n/a"} user=${payload.userId || "n/a"} email=${payload.userEmail || "n/a"} before=${payload.beforeStatus || "n/a"}/${payload.beforeActive === null || payload.beforeActive === undefined ? "n/a" : String(payload.beforeActive)} after=${payload.afterStatus || "n/a"}/${payload.afterActive === null || payload.afterActive === undefined ? "n/a" : String(payload.afterActive)} decision=${payload.decision} reason=${payload.reason}`,
    );
};

const normalizeAsaasApiUrl = (rawUrl: string) => {
    const sanitized = normalizeEnvValue(rawUrl).replace(/\/+$/, "");
    if (!sanitized) {
        return "https://api-sandbox.asaas.com/v3";
    }
    if (/\/v3$/i.test(sanitized)) {
        return sanitized;
    }
    if (/\/v\d+$/i.test(sanitized)) {
        return sanitized;
    }
    return `${sanitized}/v3`;
};

const calculateGraceEndDate = (dueDate: Date) => {
    const graceEnd = new Date(dueDate);
    graceEnd.setDate(graceEnd.getDate() + BILLING_GRACE_DAYS);
    return graceEnd;
};

const extractPaymentDate = (payment: Record<string, any>) => {
    const rawDate =
        payment.paymentDate ||
        payment.clientPaymentDate ||
        payment.confirmedDate ||
        payment.dateCreated;
    if (!rawDate) {
        return null;
    }
    const parsed = new Date(rawDate);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const isSameMonthAndYear = (baseDate: Date, now: Date) =>
    baseDate.getMonth() === now.getMonth() && baseDate.getFullYear() === now.getFullYear();

type AsaasBillingSnapshot = {
    latestPaymentDate: Date | null;
    hasAnyConfirmedPayment: boolean;
    hasCurrentMonthPayment: boolean;
    hasActiveSubscription: boolean;
    activeSubscriptionId: string | null;
    subscriptionBaseDate: Date | null;
    sourceUrl: string;
};

async function resolveAsaasBillingSnapshot(companyId: string, ownerEmail?: string): Promise<AsaasBillingSnapshot | null> {
    const fallbackApiKey =
        (await readEnvFallback("ASAAS_API_KEY")) ||
        (await readEnvFallback("ASAAS_ACCESS_TOKEN"));
    const fallbackApiUrl =
        (await readEnvFallback("ASAAS_API_URL")) ||
        (await readEnvFallback("ASAAS_BASE_URL"));

    const keyCandidates = [
        normalizeEnvValue(process.env.ASAAS_API_KEY),
        normalizeEnvValue(process.env.ASAAS_ACCESS_TOKEN),
        normalizeEnvValue(fallbackApiKey),
    ].filter(Boolean) as string[];
    const urlCandidates = [
        normalizeAsaasApiUrl(normalizeEnvValue(process.env.ASAAS_API_URL)),
        normalizeAsaasApiUrl(normalizeEnvValue(process.env.ASAAS_BASE_URL)),
        normalizeAsaasApiUrl(normalizeEnvValue(fallbackApiUrl)),
        "https://api-sandbox.asaas.com/v3",
    ].filter(Boolean) as string[];

    if (keyCandidates.length === 0) {
        console.warn(`[AUTH_SYNC] ASAAS API key ausente. Não foi possível validar pagamento para companyId=${companyId}.`);
        return null;
    }

    const now = new Date();
    let bestSnapshot: AsaasBillingSnapshot | null = null;

    for (const asaasApiKey of keyCandidates) {
        for (const asaasApiUrl of urlCandidates) {
            const fetchPayments = async (url: string) => {
                const response = await fetch(url, {
                    method: "GET",
                    headers: {
                        access_token: asaasApiKey
                    }
                });

                if (!response.ok) {
                    return [] as Array<Record<string, any>>;
                }

                const payload = await response.json() as { data?: Array<Record<string, any>> };
                return payload.data || [];
            };

            let customerIdByEmail = "";
            const foundPayments: Array<Record<string, any>> = [];
            let subscriptionBaseDate: Date | null = null;
            let hasActiveSubscription = false;
            let activeSubscriptionId: string | null = null;

            for (const paidStatus of paidStatuses) {
                const byExternalReference = await fetchPayments(
                    `${asaasApiUrl}/payments?externalReference=${encodeURIComponent(companyId)}&status=${paidStatus}&limit=10`,
                );

                let byCustomer: Array<Record<string, any>> = [];
                if (ownerEmail) {
                    if (!customerIdByEmail) {
                        const customerResponse = await fetch(
                            `${asaasApiUrl}/customers?email=${encodeURIComponent(ownerEmail)}`,
                            {
                                method: "GET",
                                headers: {
                                    access_token: asaasApiKey
                                }
                            },
                        );
                        if (customerResponse.ok) {
                            const customerPayload = await customerResponse.json() as {
                                data?: Array<{ id?: string }>;
                            };
                            customerIdByEmail = customerPayload.data?.[0]?.id || "";
                        }
                    }
                    if (customerIdByEmail) {
                        byCustomer = await fetchPayments(
                            `${asaasApiUrl}/payments?customer=${encodeURIComponent(customerIdByEmail)}&status=${paidStatus}&limit=10`,
                        );
                    }
                }

                const eligiblePayments = [...byExternalReference, ...byCustomer].filter((candidate) => {
                    if (!candidate) {
                        return false;
                    }
                    if (candidate.externalReference && candidate.externalReference !== companyId) {
                        return false;
                    }
                    return true;
                });

                if (eligiblePayments.length > 0) {
                    foundPayments.push(...eligiblePayments);
                }
            }

            if (customerIdByEmail) {
                const subscriptionsResponse = await fetch(
                    `${asaasApiUrl}/subscriptions?customer=${encodeURIComponent(customerIdByEmail)}&status=ACTIVE&limit=1`,
                    {
                        method: "GET",
                        headers: {
                            access_token: asaasApiKey
                        }
                    },
                );

                if (subscriptionsResponse.ok) {
                    const subscriptionsPayload = await subscriptionsResponse.json() as {
                        data?: Array<Record<string, any>>;
                    };
                    const activeSubscription = subscriptionsPayload.data?.[0];
                    if (activeSubscription) {
                        activeSubscriptionId = activeSubscription.id ? String(activeSubscription.id) : null;
                        const baseDateRaw =
                            activeSubscription.dateCreated ||
                            activeSubscription.nextDueDate ||
                            new Date().toISOString();
                        const baseDate = new Date(baseDateRaw);
                        subscriptionBaseDate = Number.isNaN(baseDate.getTime()) ? new Date() : baseDate;
                        hasActiveSubscription = true;
                    }
                }
            }

            const uniquePayments = [...new Map(
                foundPayments.map((payment) => {
                    const paymentId = payment?.id
                        ? String(payment.id)
                        : `${payment?.externalReference || "noref"}-${payment?.dateCreated || payment?.paymentDate || Math.random()}`;
                    return [paymentId, payment];
                }),
            ).values()];

            const normalizedDates = uniquePayments
                .map((payment) => extractPaymentDate(payment))
                .filter((date): date is Date => !!date)
                .sort((a, b) => b.getTime() - a.getTime());

            const latestPaymentDate = normalizedDates[0] || null;
            const hasAnyConfirmedPayment = uniquePayments.length > 0;
            const hasCurrentMonthPayment = normalizedDates.some((paymentDate) => isSameMonthAndYear(paymentDate, now));

            const snapshot: AsaasBillingSnapshot = {
                latestPaymentDate,
                hasAnyConfirmedPayment,
                hasCurrentMonthPayment,
                hasActiveSubscription,
                activeSubscriptionId,
                subscriptionBaseDate,
                sourceUrl: asaasApiUrl,
            };

            if (snapshot.hasCurrentMonthPayment || snapshot.hasActiveSubscription) {
                return snapshot;
            }

            if (!bestSnapshot) {
                bestSnapshot = snapshot;
                continue;
            }

            if (!bestSnapshot.latestPaymentDate && snapshot.latestPaymentDate) {
                bestSnapshot = snapshot;
                continue;
            }

            if (
                bestSnapshot.latestPaymentDate &&
                snapshot.latestPaymentDate &&
                snapshot.latestPaymentDate.getTime() > bestSnapshot.latestPaymentDate.getTime()
            ) {
                bestSnapshot = snapshot;
            }
        }
    }

    return bestSnapshot;
}

export async function syncAsaasPaymentForCompany(
    companyId: string,
    ownerId: string,
    ownerEmail?: string,
    options?: {
        requireCurrentMonthPayment?: boolean;
        activationWindowDays?: number;
        ignoreBlockDate?: boolean;
        bypassCache?: boolean;
    },
) {
    // 1. Verificar se já existe uma sincronização em andamento ou recentemente concluída
    const cached = syncCache.get(companyId);
    const nowTs = Date.now();
    const bypassCache = options?.bypassCache ?? false;

    if (!bypassCache && cached && (nowTs - cached.timestamp < SYNC_CACHE_TTL)) {
        console.log(`[SYNC_CACHE] Usando sincronização recente para ${companyId} (idade: ${nowTs - cached.timestamp}ms)`);
        return cached.promise;
    }

    const syncPromise = (async () => {
        const ignoreBlockDate = options?.ignoreBlockDate ?? false;
        // Busca a empresa para verificar a data do último bloqueio (updatedAt)
        const [currentCompany] = await db.select({
            id: schema.companies.id,
            subscriptionStatus: schema.companies.subscriptionStatus,
            active: schema.companies.active,
            updatedAt: schema.companies.updatedAt,
            billingAnchorDay: schema.companies.billingAnchorDay,
            asaasSubscriptionId: schema.companies.asaasSubscriptionId,
            firstSubscriptionAt: schema.companies.firstSubscriptionAt,
        })
            .from(schema.companies)
            .where(eq(schema.companies.id, companyId))
            .limit(1);

        const billingSnapshot = await resolveAsaasBillingSnapshot(companyId, ownerEmail);
        const requireCurrentMonthPayment = options?.requireCurrentMonthPayment ?? false;
        const activationWindowDays = options?.activationWindowDays ?? ACTIVATION_WINDOW_DAYS;
        const now = new Date();

        // Lógica para ignorar pagamentos antigos se a empresa estiver bloqueada
        // Permitimos pagamentos que ocorreram no mesmo dia ou depois do último bloqueio (updatedAt)
        // Subtraímos 12 horas da data de bloqueio para dar uma margem de segurança contra delays de API e fuso horário
        const isCurrentlyBlocked =
            currentCompany?.subscriptionStatus === "past_due" ||
            currentCompany?.subscriptionStatus === "blocked" ||
            currentCompany?.active === false;
        const lastBlockDate = currentCompany?.updatedAt || new Date(0);
        const safetyMargin = 12 * 60 * 60 * 1000; // 12 horas de margem

        const hasNewPaymentAfterBlock = !!billingSnapshot?.latestPaymentDate &&
            (billingSnapshot.latestPaymentDate.getTime() > (lastBlockDate.getTime() - safetyMargin));

        const latestPaymentIsRecent = !!billingSnapshot?.latestPaymentDate &&
            ((now.getTime() - billingSnapshot.latestPaymentDate.getTime()) <= (activationWindowDays * 24 * 60 * 60 * 1000));
        const subscriptionBaseIsRecent = !!billingSnapshot?.subscriptionBaseDate &&
            ((now.getTime() - billingSnapshot.subscriptionBaseDate.getTime()) <= (activationWindowDays * 24 * 60 * 60 * 1000));

        if (!billingSnapshot) {
            console.warn(`[AUTH_SYNC] Nenhum pagamento confirmado encontrado no Asaas para companyId=${companyId} (email=${ownerEmail || "n/a"}).`);
            return null;
        }

        // Se estiver bloqueado, só libera se houver um pagamento NOVO (pós-bloqueio) ou se for ignorada a data de bloqueio (manual)
        // Se não estiver bloqueado, aceita pagamentos recentes (35 dias) ou do mês atual
        const canActivateByPayment =
            billingSnapshot.hasAnyConfirmedPayment &&
            (isCurrentlyBlocked && !ignoreBlockDate
                ? hasNewPaymentAfterBlock
                : (requireCurrentMonthPayment
                    ? billingSnapshot.hasCurrentMonthPayment
                    : (billingSnapshot.hasCurrentMonthPayment || latestPaymentIsRecent)));

        const canActivateBySubscription =
            billingSnapshot.hasActiveSubscription &&
            billingSnapshot.hasAnyConfirmedPayment &&
            (isCurrentlyBlocked && !ignoreBlockDate
                ? hasNewPaymentAfterBlock
                : (requireCurrentMonthPayment
                    ? billingSnapshot.hasCurrentMonthPayment
                    : (latestPaymentIsRecent || subscriptionBaseIsRecent)));

        if (!canActivateByPayment && !canActivateBySubscription) {
            console.log(`[AUTH_SYNC] Falha na ativação para companyId=${companyId}:`, {
                isCurrentlyBlocked,
                ignoreBlockDate,
                hasNewPaymentAfterBlock,
                hasAnyConfirmedPayment: billingSnapshot.hasAnyConfirmedPayment,
                hasCurrentMonthPayment: billingSnapshot.hasCurrentMonthPayment,
                latestPaymentIsRecent,
                hasActiveSubscription: billingSnapshot.hasActiveSubscription,
                subscriptionBaseIsRecent,
                latestPaymentDate: billingSnapshot.latestPaymentDate,
                lastBlockDate
            });
            if (isCurrentlyBlocked && (billingSnapshot.hasAnyConfirmedPayment || billingSnapshot.hasActiveSubscription)) {
                console.warn(`[AUTH_SYNC] Assinatura/Pagamento encontrado, mas é antigo (anterior ao bloqueio). Ignorando ativação para companyId=${companyId}.`);
            } else if (requireCurrentMonthPayment) {
                console.warn(`[AUTH_SYNC] Nenhum pagamento confirmado no mês atual ou nos últimos ${activationWindowDays} dias para companyId=${companyId}.`);
            } else {
                console.warn(`[AUTH_SYNC] Nenhum pagamento confirmado elegível para companyId=${companyId}.`);
            }
            return null;
        }

        const paymentDate = billingSnapshot.latestPaymentDate || billingSnapshot.subscriptionBaseDate || new Date();
        const resolvedAnchorDay = resolveBillingAnchorDay(currentCompany?.billingAnchorDay);
        const nextDue = calculateAnchoredNextBillingDate(paymentDate, resolvedAnchorDay);

        await db.update(schema.companies)
            .set({
                subscriptionStatus: "active",
                active: true,
                accessType: "automatic",
                asaasSubscriptionId:
                    currentCompany?.asaasSubscriptionId ||
                    billingSnapshot.activeSubscriptionId,
                billingAnchorDay: resolvedAnchorDay,
                billingGraceEndsAt: null,
                trialEndsAt: nextDue,
                blockedAt: null,
                firstSubscriptionAt: currentCompany?.firstSubscriptionAt || paymentDate,
                updatedAt: new Date()
            })
            .where(eq(schema.companies.id, companyId));

        if (ownerId) {
            await db.update(schema.user)
                .set({
                    active: true,
                    updatedAt: new Date()
                })
                .where(eq(schema.user.id, ownerId));
        }

        console.log(`[AUTH_SYNC] Pagamento encontrado no Asaas usando baseUrl=${billingSnapshot.sourceUrl}.`);
        return {
            activated: true,
            nextDue
        };
    })();

    syncCache.set(companyId, { promise: syncPromise, timestamp: nowTs });
    return syncPromise;
}

const resolveCompanyIdForAuthorization = async (user: any, request: Request) => {
    const headerCompanyId = request.headers.get("x-company-id");
    if (headerCompanyId) {
        return headerCompanyId;
    }

    const slugFromHeader = request.headers.get("x-business-slug");
    if (slugFromHeader) {
        const [companyBySlug] = await db
            .select({ id: schema.companies.id })
            .from(schema.companies)
            .where(eq(schema.companies.slug, slugFromHeader))
            .limit(1);
        if (companyBySlug?.id) return companyBySlug.id;
    }

    if (user?.businessId) {
        return user.businessId;
    }

    if (user?.id) {
        const [ownedCompany] = await db
            .select({ id: schema.companies.id })
            .from(schema.companies)
            .where(eq(schema.companies.ownerId, user.id))
            .limit(1);
        if (ownedCompany?.id) return ownedCompany.id;
    }

    return null;
};

export const authPlugin = new Elysia({ name: "auth-plugin" })
    .derive({ as: 'global' }, async ({ request, path, set }) => {
        const isAuthRoute =
            path.startsWith("/api/auth") ||
            path.startsWith("/sign-in") ||
            path.startsWith("/sign-out") ||
            path === "/get-session" ||
            path === "/session";
        const isPublicAssetRoute = path.startsWith("/api/storage");

        const isExemptFromBlocking =
            isAuthRoute ||
            isPublicAssetRoute ||
            path === "/api/business/settings/pricing" ||
            path === "/api/business/sync";
        const billingAuditEnabled = isTruthy(
            normalizeEnvValue(process.env.BILLING_AUDIT_MODE) ||
            (await readEnvFallback("BILLING_AUDIT_MODE")),
        );

        // Assets públicos (como logos/favicons) não dependem de sessão e
        // não devem passar pelas regras de bloqueio de cobrança/acesso.
        if (isAuthRoute || isPublicAssetRoute) {
            return { user: null, session: null };
        }

        try {
            // Exceção para rotas do Master Admin
            const isMasterRoute = path.startsWith("/api/admin/master");
            const isHealthRoute = path.startsWith("/api/health");

            const authHeader = request.headers.get("authorization");
            const cookieHeader = request.headers.get("cookie");
            const headers = new Headers(request.headers);

            // Injeção de Token do Header para Cookie (suporte a Bearer Token)
            if (authHeader && authHeader.startsWith("Bearer ")) {
                const token = authHeader.substring(7).trim();
                const cookieName = "better-auth.session_token";

                let cookieString = cookieHeader || "";
                if (!cookieString.includes(cookieName)) {
                    cookieString += (cookieString ? "; " : "") + `${cookieName}=${token}`;
                }
                headers.set("cookie", cookieString);
            }

            // Força o host para bater com o baseURL do Better Auth se necessário
            const baseURL = new URL(auth.options.baseURL || "http://localhost:3001");
            headers.set("host", baseURL.host);

            let user: any = null;
            let session: any = null;

            const authSession = await auth.api.getSession({
                headers: headers,
            });

            if (!authSession && cookieHeader && cookieHeader.includes("better-auth.session_token")) {
                console.log(">>> [AUTH_CLEANUP] Sessão inválida/antiga detectada no banco novo. Limpando cookies...");
                set.headers["Set-Cookie"] = "better-auth.session_token=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax";
            }

            if (authSession) {
                user = authSession.user;
                session = authSession.session;
            } else {
                if (authHeader && authHeader.startsWith("Bearer ")) {
                    const token = authHeader.substring(7).trim();
                    let sessionRow = null;

                    const byToken = await db
                        .select()
                        .from(schema.session)
                        .where(eq(schema.session.token, token))
                        .limit(1);

                    if (byToken.length > 0) {
                        sessionRow = byToken[0];
                    } else {
                        const byId = await db
                            .select()
                            .from(schema.session)
                            .where(eq(schema.session.id, token))
                            .limit(1);
                        if (byId.length > 0) {
                            sessionRow = byId[0];
                        }
                    }

                    if (sessionRow) {
                        const now = new Date();
                        const expires = new Date(sessionRow.expiresAt);

                        if (expires > now) {
                            const userResults = await db
                                .select()
                                .from(schema.user)
                                .where(eq(schema.user.id, sessionRow.userId))
                                .limit(1);

                            const userRow = userResults[0];
                            if (userRow) {
                                user = {
                                    ...userRow,
                                    role: userRow.role
                                };
                                session = sessionRow;
                            }
                        }
                    }
                }
            }

            // Enriquecimento com dados do business e Verificação de Status
            if (user && user.id) {
                try {
                    // FIX: Busca explícita na tabela companies usando o ownerId
                    // Isso garante que o slug e o businessId estejam sempre atualizados
                    let businessResults: any[] = [];
                    try {
                        businessResults = await db
                            .select({
                                id: schema.companies.id,
                                name: schema.companies.name,
                                slug: schema.companies.slug,
                                ownerId: schema.companies.ownerId,
                                active: schema.companies.active,
                                subscriptionStatus: schema.companies.subscriptionStatus,
                                trialEndsAt: schema.companies.trialEndsAt,
                                asaasSubscriptionId: schema.companies.asaasSubscriptionId,
                                billingAnchorDay: schema.companies.billingAnchorDay,
                                billingGraceEndsAt: schema.companies.billingGraceEndsAt,
                                billingDayLastChangedAt: schema.companies.billingDayLastChangedAt,
                                accessType: schema.companies.accessType,
                            })
                            .from(schema.companies)
                            .where(eq(schema.companies.ownerId, user.id))
                            .limit(1);
                    } catch (queryError: any) {
                        const errorMessage = String(queryError?.message || "");
                        const isMissingColumnError =
                            queryError?.code === "42703" ||
                            errorMessage.toLowerCase().includes("does not exist");

                        if (!isMissingColumnError) {
                            throw queryError;
                        }

                        console.warn(
                            `[AUTH_PLUGIN] Colunas de billing indisponíveis no banco atual. Aplicando fallback legado. Detalhe: ${errorMessage}`,
                        );

                        businessResults = await db
                            .select({
                                id: schema.companies.id,
                                name: schema.companies.name,
                                slug: schema.companies.slug,
                                ownerId: schema.companies.ownerId,
                                active: schema.companies.active,
                                subscriptionStatus: schema.companies.subscriptionStatus,
                                trialEndsAt: schema.companies.trialEndsAt,
                                asaasSubscriptionId: schema.companies.asaasSubscriptionId,
                            })
                            .from(schema.companies)
                            .where(eq(schema.companies.ownerId, user.id))
                            .limit(1);
                    }

                    const baseCompany = businessResults[0];
                    const userCompany = baseCompany
                        ? {
                            ...baseCompany,
                            accessType: baseCompany.accessType || "automatic",
                            billingAnchorDay: baseCompany.billingAnchorDay ?? null,
                            billingGraceEndsAt: baseCompany.billingGraceEndsAt ?? null,
                            billingDayLastChangedAt:
                                baseCompany.billingDayLastChangedAt ?? null,
                        }
                        : null;

                    // Log de depuração detalhado para diagnosticar problemas de login
                    console.log(`>>> [AUTH_DEBUG] User: ${user.email} (ID: ${user.id})`);
                    if (userCompany) {
                        console.log(`>>> [AUTH_DEBUG] Business Found -> ID: ${userCompany.id} | Slug: ${userCompany.slug} | Active: ${userCompany.active}`);
                    } else {
                        console.log(`>>> [AUTH_DEBUG] NO BUSINESS FOUND for this user.`);
                    }

                    // 1. BLOQUEIO POR CONTA DE USUÁRIO DESATIVADA (Restritivo)
                    if (user.active === false && !isMasterRoute && !isExemptFromBlocking && !isHealthRoute && user.role !== "SUPER_ADMIN") {
                        const isAutomaticBillingBlocked =
                            !!userCompany &&
                            userCompany.accessType === "automatic" &&
                            userCompany.active === false &&
                            (
                                userCompany.subscriptionStatus === "past_due" ||
                                userCompany.subscriptionStatus === "inactive" ||
                                userCompany.subscriptionStatus === "canceled"
                            );
                        if (isAutomaticBillingBlocked) {
                            console.warn(`[AUTH_BLOCK]: Conta com flag inativa, mas bloqueio é de cobrança automática para ${userCompany.slug}.`);
                        } else {
                            console.warn(`[AUTH_BLOCK]: Conta de usuário desativada: ${user.email}`);

                            set.status = 403;
                            throw new Error("ACCOUNT_SUSPENDED");
                        }
                    }

                    if (userCompany) {
                        // 1. BLOQUEIO POR CONTA DE USUÁRIO DESATIVADA (Restritivo)
                        if (userCompany.active === false && !isMasterRoute && !isExemptFromBlocking && !isHealthRoute && user.role !== "SUPER_ADMIN" && user.role !== "ADMIN") {
                            const isAutomaticBillingBlocked =
                                userCompany.accessType === "automatic" &&
                                (
                                    userCompany.subscriptionStatus === "past_due" ||
                                    userCompany.subscriptionStatus === "inactive" ||
                                    userCompany.subscriptionStatus === "canceled"
                                );

                            if (isAutomaticBillingBlocked) {
                                // Tenta sincronizar. Se falhar, faz uma pequena pausa e tenta de novo (retry) 
                                // para dar tempo do Asaas processar se o usuário acabou de pagar.
                                let syncResult = await syncAsaasPaymentForCompany(
                                    userCompany.id,
                                    userCompany.ownerId,
                                    user.email,
                                    {
                                        requireCurrentMonthPayment: false,
                                        activationWindowDays: 10,
                                        ignoreBlockDate: true,
                                        bypassCache: true,
                                    },
                                );

                                if (!syncResult?.activated) {
                                    console.log(`[AUTH_SYNC] Primeira tentativa falhou para ${userCompany.slug}. Tentando retry em 2s...`);
                                    await new Promise(resolve => setTimeout(resolve, 2000));
                                    syncResult = await syncAsaasPaymentForCompany(
                                        userCompany.id,
                                        userCompany.ownerId,
                                        user.email,
                                        {
                                            requireCurrentMonthPayment: false,
                                            activationWindowDays: 10,
                                            ignoreBlockDate: true,
                                            bypassCache: true,
                                        },
                                    );
                                }

                                if (syncResult?.activated) {
                                    userCompany.active = true;
                                    userCompany.subscriptionStatus = "active";
                                    userCompany.trialEndsAt = syncResult.nextDue;
                                    console.log(`[AUTH_SYNC] Reativação imediata concluída para ${userCompany.slug} durante validação de bloqueio.`);
                                } else {
                                    // Evita bloqueio imediato após vencimento: entra em carência para aguardar
                                    // compensação do débito automático no cartão.
                                    const now = new Date();
                                    const dueDate = userCompany.trialEndsAt
                                        ? new Date(userCompany.trialEndsAt)
                                        : now;
                                    const effectiveGraceEnd = userCompany.billingGraceEndsAt
                                        ? new Date(userCompany.billingGraceEndsAt)
                                        : calculateGraceEndDate(dueDate);

                                    if (now <= effectiveGraceEnd) {
                                        await db.update(schema.companies)
                                            .set({
                                                subscriptionStatus: "grace_period",
                                                active: true,
                                                billingGraceEndsAt: effectiveGraceEnd,
                                                updatedAt: now,
                                            })
                                            .where(eq(schema.companies.id, userCompany.id));
                                        await db.update(schema.user)
                                            .set({
                                                active: true,
                                                updatedAt: now,
                                            })
                                            .where(eq(schema.user.id, userCompany.ownerId));

                                        userCompany.active = true;
                                        userCompany.subscriptionStatus = "grace_period";
                                        userCompany.billingGraceEndsAt = effectiveGraceEnd;
                                        console.warn(
                                            `[AUTH_GRACE] ${userCompany.slug} em carência durante espera de compensação automática até ${effectiveGraceEnd.toISOString()}.`,
                                        );
                                    } else {
                                        console.warn(`[AUTH_BLOCK]: Estabelecimento bloqueado por cobrança pendente: ${userCompany.slug}`);
                                        set.status = 402;
                                        throw new Error("BILLING_REQUIRED");
                                    }
                                }
                            } else {
                                console.warn(`[AUTH_BLOCK]: Conta de usuário desativada: ${user.email}`);

                                set.status = 403;
                                throw new Error("ACCOUNT_SUSPENDED");
                            }
                        }

                        const daysLeft = userCompany.trialEndsAt ? Math.ceil((new Date(userCompany.trialEndsAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : 0;

                        user.business = {
                            ...userCompany,
                            daysLeft
                        };
                        user.slug = userCompany.slug; // Fundamental para o redirecionamento no Front
                        user.businessId = userCompany.id;

                        // 2. BLOQUEIO POR ASSINATURA (SaaS)
                        // Verifica se o usuário tem permissão de acesso baseado na assinatura
                        if (!isMasterRoute && !isExemptFromBlocking && !isHealthRoute && user.role !== "SUPER_ADMIN") {
                            const now = new Date();
                            let status = userCompany.subscriptionStatus;
                            let trialEnds = userCompany.trialEndsAt ? new Date(userCompany.trialEndsAt) : null;
                            let graceEnds = userCompany.billingGraceEndsAt ? new Date(userCompany.billingGraceEndsAt) : null;
                            const isPendingCancellation = user.accountStatus === "PENDING_CANCELLATION";
                            const auditBeforeStatus = userCompany.subscriptionStatus;
                            const auditBeforeActive = userCompany.active;
                            let auditReason = "status_check";
                            const isTrialStatus = status === 'trial' || status === 'trialing';
                            let isManualActive =
                                userCompany.accessType === "manual" ||
                                status === 'manual' ||
                                status === 'manual_active';
                            const isManualOrExtendedAccess =
                                userCompany.accessType === "manual" ||
                                userCompany.accessType === "extended_trial";

                            if (isPendingCancellation) {
                                if (trialEnds && now <= trialEnds) {
                                    // Cancelado com período já pago: mantém acesso até o fim do ciclo.
                                    if (status !== "active" || userCompany.active === false) {
                                        await db.update(schema.companies)
                                            .set({
                                                subscriptionStatus: "active",
                                                active: true,
                                                billingGraceEndsAt: null,
                                                updatedAt: now,
                                            })
                                            .where(eq(schema.companies.id, userCompany.id));
                                        await db.update(schema.user)
                                            .set({
                                                active: true,
                                                updatedAt: now,
                                            })
                                            .where(eq(schema.user.id, userCompany.ownerId));
                                        status = "active";
                                        userCompany.active = true;
                                        userCompany.subscriptionStatus = "active";
                                    }
                                    auditReason = "pending_cancellation_within_paid_cycle";
                                } else {
                                    // Fim do ciclo alcançado: encerra acesso sem carência.
                                    await db.update(schema.companies)
                                        .set({
                                            subscriptionStatus: "canceled",
                                            active: false,
                                            billingGraceEndsAt: null,
                                            updatedAt: now,
                                        })
                                        .where(eq(schema.companies.id, userCompany.id));
                                    await db.update(schema.user)
                                        .set({
                                            active: false,
                                            updatedAt: now,
                                        })
                                        .where(eq(schema.user.id, userCompany.ownerId));
                                    status = "canceled";
                                    userCompany.active = false;
                                    userCompany.subscriptionStatus = "canceled";
                                    auditReason = "pending_cancellation_cycle_ended";
                                }
                            }

                            if (isManualOrExtendedAccess && trialEnds && now > trialEnds) {
                                const manualExpiredSync = await syncAsaasPaymentForCompany(
                                    userCompany.id,
                                    userCompany.ownerId,
                                    user.email,
                                    {
                                        requireCurrentMonthPayment: false,
                                        activationWindowDays: 10,
                                        ignoreBlockDate: true,
                                        bypassCache: true,
                                    },
                                );

                                if (manualExpiredSync?.activated) {
                                    userCompany.active = true;
                                    userCompany.subscriptionStatus = "active";
                                    userCompany.trialEndsAt = manualExpiredSync.nextDue;
                                    userCompany.billingGraceEndsAt = null;
                                    userCompany.accessType = "automatic";
                                    status = "active";
                                    trialEnds = manualExpiredSync.nextDue;
                                    graceEnds = null;
                                    auditReason = "manual_expired_gateway_confirmed";
                                } else {
                                    await db.update(schema.companies)
                                        .set({
                                            subscriptionStatus: "blocked",
                                            active: false,
                                            billingGraceEndsAt: null,
                                            blockedAt: now,
                                            updatedAt: now,
                                        })
                                        .where(eq(schema.companies.id, userCompany.id));
                                    await db.update(schema.user)
                                        .set({
                                            active: false,
                                            updatedAt: now,
                                        })
                                        .where(eq(schema.user.id, userCompany.ownerId));
                                    userCompany.active = false;
                                    userCompany.subscriptionStatus = "blocked";
                                    status = "blocked";
                                    auditReason = "manual_expired_without_gateway_payment";
                                }
                            }

                            // Se estiver bloqueado ou com pagamento pendente, tenta sincronizar uma última vez
                            const isAutomaticAccess = userCompany.accessType === "automatic" && !isTrialStatus && !isManualActive;
                            if (isAutomaticAccess) {
                                // Janela de renovação: 3 dias antes do vencimento já tenta sincronizar
                                // para liberar imediatamente caso o Asaas já tenha gerado/confirmado a nova fatura.
                                if (status === "active" && trialEnds) {
                                    const msUntilDue = trialEnds.getTime() - now.getTime();
                                    const daysUntilDue = msUntilDue / (1000 * 60 * 60 * 24);
                                    if (daysUntilDue <= RENEWAL_SYNC_WINDOW_DAYS) {
                                        const renewalSyncResult = await syncAsaasPaymentForCompany(
                                            userCompany.id,
                                            userCompany.ownerId,
                                            user.email,
                                            {
                                                requireCurrentMonthPayment: false,
                                                ignoreBlockDate: true,
                                                bypassCache: true,
                                            },
                                        );
                                        if (renewalSyncResult?.activated) {
                                            userCompany.active = true;
                                            userCompany.subscriptionStatus = "active";
                                            userCompany.trialEndsAt = renewalSyncResult.nextDue;
                                            userCompany.billingGraceEndsAt = null;
                                            status = "active";
                                            trialEnds = renewalSyncResult.nextDue;
                                            graceEnds = null;
                                            auditReason = "renewal_sync_confirmed";
                                            console.log(`[AUTH_RENEWAL] Renovação antecipada confirmada no Asaas para ${userCompany.slug}.`);
                                        }
                                    }
                                }

                                if (status !== "active") {
                                    const syncResult = await syncAsaasPaymentForCompany(
                                        userCompany.id,
                                        userCompany.ownerId,
                                        user.email,
                                        {
                                            requireCurrentMonthPayment: false,
                                            activationWindowDays: 10,
                                            ignoreBlockDate: true,
                                            bypassCache: true,
                                        },
                                    );

                                    if (syncResult?.activated) {
                                        userCompany.active = true;
                                        userCompany.subscriptionStatus = "active";
                                        userCompany.trialEndsAt = syncResult.nextDue;
                                        userCompany.billingGraceEndsAt = null;
                                        status = "active";
                                        trialEnds = syncResult.nextDue;
                                        graceEnds = null;
                                        auditReason = "sync_confirmed";
                                        console.log(`[AUTH_SYNC] Pagamento confirmado no Asaas para ${userCompany.slug}. Acesso reativado automaticamente.`);
                                    } else if (status === "grace_period") {
                                        const effectiveGraceEnd = graceEnds || (trialEnds ? calculateGraceEndDate(trialEnds) : null);
                                        if (effectiveGraceEnd && now > effectiveGraceEnd) {
                                            await db.update(schema.companies)
                                                .set({
                                                    subscriptionStatus: "blocked",
                                                    active: false,
                                                    billingGraceEndsAt: effectiveGraceEnd,
                                                    blockedAt: new Date(),
                                                    updatedAt: new Date()
                                                })
                                                .where(eq(schema.companies.id, userCompany.id));
                                            userCompany.active = false;
                                            userCompany.subscriptionStatus = "blocked";
                                            userCompany.billingGraceEndsAt = effectiveGraceEnd;
                                            status = "blocked";
                                            graceEnds = effectiveGraceEnd;
                                            auditReason = "grace_expired_after_sync";
                                        }
                                    }
                                }

                                // Venceu e não pagou: entra em carência de 7 dias antes de bloquear
                                if (status === "active" && trialEnds && now > trialEnds) {
                                    const graceEnd = calculateGraceEndDate(trialEnds);
                                    await db.update(schema.companies)
                                        .set({
                                            subscriptionStatus: "grace_period",
                                            active: true,
                                            billingGraceEndsAt: graceEnd,
                                            updatedAt: new Date()
                                        })
                                        .where(eq(schema.companies.id, userCompany.id));
                                    await db.update(schema.user)
                                        .set({
                                            active: true,
                                            updatedAt: new Date(),
                                        })
                                        .where(eq(schema.user.id, userCompany.ownerId));
                                    status = "grace_period";
                                    graceEnds = graceEnd;
                                    userCompany.subscriptionStatus = "grace_period";
                                    userCompany.billingGraceEndsAt = graceEnd;
                                    auditReason = "entered_grace_due_to_expiration";
                                    console.warn(`[AUTH_GRACE] ${userCompany.slug} entrou em carência até ${graceEnd.toISOString()}.`);
                                }

                                if (status === "grace_period" && graceEnds && now > graceEnds) {
                                    await db.update(schema.companies)
                                        .set({
                                            subscriptionStatus: "blocked",
                                            active: false,
                                            billingGraceEndsAt: graceEnds,
                                            blockedAt: new Date(),
                                            updatedAt: new Date()
                                        })
                                        .where(eq(schema.companies.id, userCompany.id));
                                    status = "blocked";
                                    userCompany.active = false;
                                    userCompany.subscriptionStatus = "blocked";
                                    auditReason = "grace_expired_blocked";
                                    console.warn(`[AUTH_SYNC] Carência expirada para ${userCompany.slug}. Rebaixado para blocked.`);
                                }
                            }

                            if (status === "active" && trialEnds && now > trialEnds) {
                                // Fallback de segurança para não deixar status ativo após vencimento.
                                const graceEnd = calculateGraceEndDate(trialEnds);
                                await db.update(schema.companies)
                                    .set({
                                        subscriptionStatus: "grace_period",
                                        active: true,
                                        billingGraceEndsAt: graceEnd,
                                        updatedAt: new Date()
                                    })
                                    .where(eq(schema.companies.id, userCompany.id));
                                await db.update(schema.user)
                                    .set({
                                        active: true,
                                        updatedAt: new Date(),
                                    })
                                    .where(eq(schema.user.id, userCompany.ownerId));
                                status = "grace_period";
                                userCompany.subscriptionStatus = "grace_period";
                                userCompany.billingGraceEndsAt = graceEnd;
                                graceEnds = graceEnd;
                                auditReason = "fallback_to_grace";
                            }

                            if (status === "grace_period" && graceEnds && now > graceEnds) {
                                await db.update(schema.companies)
                                    .set({
                                        subscriptionStatus: "blocked",
                                        active: false,
                                        blockedAt: new Date(),
                                        updatedAt: new Date()
                                    })
                                    .where(eq(schema.companies.id, userCompany.id));
                                status = "blocked";
                                userCompany.active = false;
                                auditReason = "fallback_grace_expired";
                            }

                            // Última tentativa forte antes de bloquear para evitar falso bloqueio
                            // quando o pagamento já foi confirmado no Asaas.
                            if (
                                isAutomaticAccess &&
                                (status === "past_due" || status === "grace_period" || status === "blocked")
                            ) {
                                const finalSync = await syncAsaasPaymentForCompany(
                                    userCompany.id,
                                    userCompany.ownerId,
                                    user.email,
                                    {
                                        requireCurrentMonthPayment: false,
                                        activationWindowDays: 10,
                                        ignoreBlockDate: true,
                                        bypassCache: true,
                                    },
                                );
                                if (finalSync?.activated) {
                                    userCompany.active = true;
                                    userCompany.subscriptionStatus = "active";
                                    userCompany.trialEndsAt = finalSync.nextDue;
                                    userCompany.billingGraceEndsAt = null;
                                    status = "active";
                                    trialEnds = finalSync.nextDue;
                                    graceEnds = null;
                                    auditReason = "final_sync_confirmed";
                                    console.log(`[AUTH_SYNC] Última tentativa confirmou pagamento e evitou bloqueio para ${userCompany.slug}.`);
                                }
                            }

                            // Validação final de acesso baseada no status resolvido
                            const isExpired = trialEnds && trialEnds < now;
                            const isBlocked =
                                status === 'blocked' ||
                                status === 'unpaid' ||
                                status === 'canceled' ||
                                status === 'inactive';

                            if (isBlocked || (isTrialStatus && isExpired)) {
                                logBillingAudit(billingAuditEnabled, {
                                    companyId: userCompany.id,
                                    slug: userCompany.slug,
                                    userId: user.id,
                                    userEmail: user.email,
                                    beforeStatus: auditBeforeStatus,
                                    afterStatus: status,
                                    beforeActive: auditBeforeActive,
                                    afterActive: userCompany.active,
                                    decision: "BLOCKED",
                                    reason: `${auditReason}|isBlocked=${String(isBlocked)}|isExpired=${String(isExpired)}`,
                                });
                                console.warn(`[AUTH_BLOCK]: Acesso negado para ${userCompany.slug} (Status: ${status}, Expired: ${isExpired})`);
                                set.status = 402;
                                throw new Error("BILLING_REQUIRED");
                            }

                            logBillingAudit(billingAuditEnabled, {
                                companyId: userCompany.id,
                                slug: userCompany.slug,
                                userId: user.id,
                                userEmail: user.email,
                                beforeStatus: auditBeforeStatus,
                                afterStatus: status,
                                beforeActive: auditBeforeActive,
                                afterActive: userCompany.active,
                                decision: status === "grace_period" ? "GRACE" : "ACTIVE",
                                reason: auditReason,
                            });
                        }
                    }
                } catch (dbError: any) {
                    if (dbError.message === "BUSINESS_SUSPENDED" || dbError.message === "ACCOUNT_SUSPENDED" || dbError.message === "BILLING_REQUIRED") {
                        throw dbError;
                    }
                    console.error(`[AUTH_PLUGIN] Erro ao buscar company:`, dbError);
                }
            }

            return {
                user: user as User | null,
                session: session as Session | null,
            };
        } catch (error: any) {
            // Repassa erros de suspensão para o onError global do index.ts
            if (error.message === "BUSINESS_SUSPENDED" || error.message === "ACCOUNT_SUSPENDED" || error.message === "BILLING_REQUIRED") {
                throw error;
            }
            console.error("[AUTH_PLUGIN] Erro ao obter sessão:", error);
            return {
                user: null,
                session: null,
            };
        }
    })
    .macro({
        auth: {
            resolve({ user, set }) {
                if (!user) {
                    set.status = 401;
                    return { error: "Unauthorized" };
                }
            },
        },
        requireAdmin: {
            async resolve({ user, set, request }) {
                if (!user) {
                    set.status = 401;
                    return { error: "Unauthorized" };
                }

                if (user.role === "SUPER_ADMIN" || user.role === "ADMIN") {
                    return;
                }

                const companyId = await resolveCompanyIdForAuthorization(user, request);
                if (!companyId) {
                    set.status = 403;
                    return { error: "Forbidden: company context not found" };
                }

                const [company] = await db
                    .select({ ownerId: schema.companies.ownerId })
                    .from(schema.companies)
                    .where(eq(schema.companies.id, companyId))
                    .limit(1);
                if (company?.ownerId === user.id) {
                    return;
                }

                const [staffMember] = await db
                    .select({
                        isAdmin: schema.staff.isAdmin,
                        isActive: schema.staff.isActive,
                    })
                    .from(schema.staff)
                    .where(
                        and(
                            eq(schema.staff.companyId, companyId),
                            eq(schema.staff.userId, user.id),
                        ),
                    )
                    .limit(1);

                if (!staffMember || !staffMember.isActive || !staffMember.isAdmin) {
                    set.status = 403;
                    return { error: "Forbidden: admin access required" };
                }
            },
        },
        requireSecretary: {
            async resolve({ user, set, request }) {
                if (!user) {
                    set.status = 401;
                    return { error: "Unauthorized" };
                }

                if (user.role === "SUPER_ADMIN" || user.role === "ADMIN") {
                    return;
                }

                const companyId = await resolveCompanyIdForAuthorization(user, request);
                if (!companyId) {
                    set.status = 403;
                    return { error: "Forbidden: company context not found" };
                }

                const [company] = await db
                    .select({ ownerId: schema.companies.ownerId })
                    .from(schema.companies)
                    .where(eq(schema.companies.id, companyId))
                    .limit(1);
                if (company?.ownerId === user.id) {
                    return;
                }

                const [staffMember] = await db
                    .select({
                        isAdmin: schema.staff.isAdmin,
                        isSecretary: schema.staff.isSecretary,
                        isActive: schema.staff.isActive,
                    })
                    .from(schema.staff)
                    .where(
                        and(
                            eq(schema.staff.companyId, companyId),
                            eq(schema.staff.userId, user.id),
                        ),
                    )
                    .limit(1);

                if (
                    !staffMember ||
                    !staffMember.isActive ||
                    (!staffMember.isAdmin && !staffMember.isSecretary)
                ) {
                    set.status = 403;
                    return { error: "Forbidden: secretary access required" };
                }
            },
        },
        requireFinancialAccess: {
            async resolve({ user, set, request }) {
                if (!user) {
                    set.status = 401;
                    return { error: "Unauthorized" };
                }

                const companyId = await resolveCompanyIdForAuthorization(user, request);
                if (!companyId) {
                    set.status = 403;
                    return { error: "Forbidden: company context not found" };
                }

                const [company] = await db
                    .select({
                        ownerId: schema.companies.ownerId,
                        financialPassword: schema.companies.financialPassword,
                    })
                    .from(schema.companies)
                    .where(eq(schema.companies.id, companyId))
                    .limit(1);

                if (!company) {
                    set.status = 403;
                    return { error: "Forbidden: company not found" };
                }

                if (company.ownerId === user.id || user.role === "SUPER_ADMIN" || user.role === "ADMIN") {
                    return;
                }

                if (!company.financialPassword) {
                    return;
                }

                const financialPasswordHeader = request.headers.get("x-financial-password");
                if (!financialPasswordHeader) {
                    set.status = 403;
                    return { error: "Forbidden: financial password required" };
                }

                const passwordMatches = await Bun.password.verify(
                    financialPasswordHeader,
                    company.financialPassword,
                );

                if (!passwordMatches) {
                    set.status = 403;
                    return { error: "Forbidden: invalid financial password" };
                }
            },
        },
        isMaster: {
            resolve({ user, set }) {
                if (!user || user.role !== "SUPER_ADMIN") {
                    set.status = 403;
                    return { error: "Forbidden: Super Admin access required" };
                }
            }
        }
    });
