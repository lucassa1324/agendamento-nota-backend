import { Elysia } from "elysia";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "../drizzle/database";
import * as schema from "../../../db/schema";
import { eq } from "drizzle-orm";
import { auth } from "./auth";

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

const daysInMonth = (year: number, monthIndex: number) =>
    new Date(year, monthIndex + 1, 0).getDate();

const clampBillingAnchorDay = (anchorDay: number) =>
    Math.min(Math.max(anchorDay, 1), 31);

const buildDateByAnchor = (year: number, monthIndex: number, anchorDay: number) => {
    const maxDay = daysInMonth(year, monthIndex);
    const day = Math.min(clampBillingAnchorDay(anchorDay), maxDay);
    return new Date(year, monthIndex, day);
};

const calculateNextDueDate = (referenceDate: Date, anchorDay: number) => {
    let due = buildDateByAnchor(referenceDate.getFullYear(), referenceDate.getMonth(), anchorDay);
    if (referenceDate.getTime() >= due.getTime()) {
        due = buildDateByAnchor(referenceDate.getFullYear(), referenceDate.getMonth() + 1, anchorDay);
    }
    return due;
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
        normalizeEnvValue(process.env.ASAAS_API_URL),
        normalizeEnvValue(process.env.ASAAS_BASE_URL),
        normalizeEnvValue(fallbackApiUrl),
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
    },
) {
    // 1. Verificar se já existe uma sincronização em andamento ou recentemente concluída
    const cached = syncCache.get(companyId);
    const nowTs = Date.now();

    if (cached && (nowTs - cached.timestamp < SYNC_CACHE_TTL)) {
        console.log(`[SYNC_CACHE] Usando sincronização recente para ${companyId} (idade: ${nowTs - cached.timestamp}ms)`);
        return cached.promise;
    }

    const syncPromise = (async () => {
        const ignoreBlockDate = options?.ignoreBlockDate ?? false;
        // Busca a empresa para verificar a data do último bloqueio (updatedAt)
        const [currentCompany] = await db.select()
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
        const isCurrentlyBlocked = currentCompany?.subscriptionStatus === "past_due" || currentCompany?.active === false;
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
        const resolvedAnchorDay = currentCompany?.billingAnchorDay || paymentDate.getDate();
        const nextDue = calculateNextDueDate(paymentDate, resolvedAnchorDay);

        await db.update(schema.companies)
            .set({
                subscriptionStatus: "active",
                active: true,
                accessType: "automatic",
                billingAnchorDay: resolvedAnchorDay,
                billingGraceEndsAt: null,
                trialEndsAt: nextDue,
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

export const authPlugin = new Elysia({ name: "auth-plugin" })
    .derive({ as: 'global' }, async ({ request, path, set }) => {
        const isAuthRoute =
            path.startsWith("/api/auth") ||
            path.startsWith("/sign-in") ||
            path.startsWith("/sign-out") ||
            path === "/get-session" ||
            path === "/session";

        const isExemptFromBlocking =
            isAuthRoute ||
            path === "/api/business/settings/pricing" ||
            path === "/api/business/sync";

        if (isAuthRoute) {
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
                    const businessResults = await db
                        .select({
                            id: schema.companies.id,
                            name: schema.companies.name,
                            slug: schema.companies.slug,
                            ownerId: schema.companies.ownerId,
                            active: schema.companies.active,
                            subscriptionStatus: schema.companies.subscriptionStatus,
                            trialEndsAt: schema.companies.trialEndsAt,
                            billingAnchorDay: schema.companies.billingAnchorDay,
                            billingGraceEndsAt: schema.companies.billingGraceEndsAt,
                            billingDayLastChangedAt: schema.companies.billingDayLastChangedAt,
                            accessType: schema.companies.accessType,
                        })
                        .from(schema.companies)
                        .where(eq(schema.companies.ownerId, user.id))
                        .limit(1);

                    const userCompany = businessResults[0];

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
                                        requireCurrentMonthPayment: true,
                                        ignoreBlockDate: false
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
                                            requireCurrentMonthPayment: true,
                                            ignoreBlockDate: false
                                        },
                                    );
                                }

                                if (syncResult?.activated) {
                                    userCompany.active = true;
                                    userCompany.subscriptionStatus = "active";
                                    userCompany.trialEndsAt = syncResult.nextDue;
                                    console.log(`[AUTH_SYNC] Reativação imediata concluída para ${userCompany.slug} durante validação de bloqueio.`);
                                } else {
                                    console.warn(`[AUTH_BLOCK]: Estabelecimento bloqueado por cobrança pendente: ${userCompany.slug}`);
                                    set.status = 402;
                                    throw new Error("BILLING_REQUIRED");
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
                            const isTrialStatus = status === 'trial' || status === 'trialing';
                            let isManualActive =
                                userCompany.accessType === "manual" ||
                                status === 'manual' ||
                                status === 'manual_active';

                            // Se estiver bloqueado ou com pagamento pendente, tenta sincronizar uma última vez
                            const isAutomaticAccess = userCompany.accessType === "automatic" && !isTrialStatus && !isManualActive;
                            if (isAutomaticAccess) {
                                if (status !== "active") {
                                    const syncResult = await syncAsaasPaymentForCompany(
                                        userCompany.id,
                                        userCompany.ownerId,
                                        user.email,
                                        {
                                            requireCurrentMonthPayment: true,
                                            ignoreBlockDate: false
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
                                        console.log(`[AUTH_SYNC] Pagamento confirmado no Asaas para ${userCompany.slug}. Acesso reativado automaticamente.`);
                                    } else if (status === "grace_period") {
                                        const effectiveGraceEnd = graceEnds || (trialEnds ? calculateGraceEndDate(trialEnds) : null);
                                        if (effectiveGraceEnd && now > effectiveGraceEnd) {
                                            await db.update(schema.companies)
                                                .set({
                                                    subscriptionStatus: "past_due",
                                                    active: false,
                                                    billingGraceEndsAt: effectiveGraceEnd,
                                                    updatedAt: new Date()
                                                })
                                                .where(eq(schema.companies.id, userCompany.id));
                                            userCompany.active = false;
                                            userCompany.subscriptionStatus = "past_due";
                                            userCompany.billingGraceEndsAt = effectiveGraceEnd;
                                            status = "past_due";
                                            graceEnds = effectiveGraceEnd;
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
                                    status = "grace_period";
                                    graceEnds = graceEnd;
                                    userCompany.subscriptionStatus = "grace_period";
                                    userCompany.billingGraceEndsAt = graceEnd;
                                    console.warn(`[AUTH_GRACE] ${userCompany.slug} entrou em carência até ${graceEnd.toISOString()}.`);
                                }

                                if (status === "grace_period" && graceEnds && now > graceEnds) {
                                    await db.update(schema.companies)
                                        .set({
                                            subscriptionStatus: "past_due",
                                            active: false,
                                            billingGraceEndsAt: graceEnds,
                                            updatedAt: new Date()
                                        })
                                        .where(eq(schema.companies.id, userCompany.id));
                                    status = "past_due";
                                    userCompany.active = false;
                                    userCompany.subscriptionStatus = "past_due";
                                    console.warn(`[AUTH_SYNC] Carência expirada para ${userCompany.slug}. Rebaixado para past_due.`);
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
                                status = "grace_period";
                                userCompany.subscriptionStatus = "grace_period";
                                userCompany.billingGraceEndsAt = graceEnd;
                                graceEnds = graceEnd;
                            }

                            if (status === "grace_period" && graceEnds && now > graceEnds) {
                                await db.update(schema.companies)
                                    .set({
                                        subscriptionStatus: "past_due",
                                        active: false,
                                        updatedAt: new Date()
                                    })
                                    .where(eq(schema.companies.id, userCompany.id));
                                status = "past_due";
                                userCompany.active = false;
                            }

                            // Validação final de acesso baseada no status resolvido
                            const isExpired = trialEnds && trialEnds < now;
                            const isBlocked = status === 'past_due' || status === 'unpaid' || status === 'canceled' || status === 'inactive';

                            if (isBlocked || (isTrialStatus && isExpired)) {
                                console.warn(`[AUTH_BLOCK]: Acesso negado para ${userCompany.slug} (Status: ${status}, Expired: ${isExpired})`);
                                set.status = 402;
                                throw new Error("BILLING_REQUIRED");
                            }
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
        isMaster: {
            resolve({ user, set }) {
                if (!user || user.role !== "SUPER_ADMIN") {
                    set.status = 403;
                    return { error: "Forbidden: Super Admin access required" };
                }
            }
        }
    });
