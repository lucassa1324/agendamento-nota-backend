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

const paidStatuses = ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"];

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

                const payment = [...byExternalReference, ...byCustomer].find((candidate) => {
                    if (!candidate) {
                        return false;
                    }
                    if (candidate.externalReference && candidate.externalReference !== companyId) {
                        return false;
                    }
                    return true;
                });

                if (payment) {
                    foundPayments.push(payment);
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

            const normalizedDates = foundPayments
                .map((payment) => extractPaymentDate(payment))
                .filter((date): date is Date => !!date)
                .sort((a, b) => b.getTime() - a.getTime());

            const latestPaymentDate = normalizedDates[0] || null;
            const hasAnyConfirmedPayment = foundPayments.length > 0;
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
    options?: { requireCurrentMonthPayment?: boolean },
) {
    // Busca a empresa para verificar a data do último bloqueio (updatedAt)
    const [currentCompany] = await db.select()
        .from(schema.companies)
        .where(eq(schema.companies.id, companyId))
        .limit(1);

    const billingSnapshot = await resolveAsaasBillingSnapshot(companyId, ownerEmail);
    const requireCurrentMonthPayment = options?.requireCurrentMonthPayment ?? false;
    const now = new Date();

    // Lógica para ignorar pagamentos antigos se a empresa estiver bloqueada
    // Se a empresa está past_due e inativa, só aceitamos pagamentos confirmados DEPOIS da última atualização (bloqueio)
    const isCurrentlyBlocked = currentCompany?.subscriptionStatus === "past_due" || currentCompany?.active === false;
    const lastBlockDate = currentCompany?.updatedAt || new Date(0);

    const hasNewPaymentAfterBlock = !!billingSnapshot?.latestPaymentDate &&
        billingSnapshot.latestPaymentDate.getTime() > lastBlockDate.getTime();

    const latestPaymentIsRecent = !!billingSnapshot?.latestPaymentDate &&
        ((now.getTime() - billingSnapshot.latestPaymentDate.getTime()) <= (35 * 24 * 60 * 60 * 1000));

    if (!billingSnapshot) {
        console.warn(`[AUTH_SYNC] Nenhum pagamento confirmado encontrado no Asaas para companyId=${companyId} (email=${ownerEmail || "n/a"}).`);
        return null;
    }

    // Se estiver bloqueado, só libera se houver um pagamento NOVO (pós-bloqueio)
    // Se não estiver bloqueado, aceita pagamentos recentes (35 dias) ou do mês atual
    const canActivateByPayment =
        billingSnapshot.hasAnyConfirmedPayment &&
        (isCurrentlyBlocked
            ? hasNewPaymentAfterBlock
            : (!requireCurrentMonthPayment || billingSnapshot.hasCurrentMonthPayment || latestPaymentIsRecent));

    const canActivateBySubscription =
        billingSnapshot.hasActiveSubscription &&
        (isCurrentlyBlocked
            ? (!!billingSnapshot.subscriptionBaseDate && billingSnapshot.subscriptionBaseDate.getTime() > lastBlockDate.getTime())
            : (!requireCurrentMonthPayment || latestPaymentIsRecent));

    if (!canActivateByPayment && !canActivateBySubscription) {
        if (isCurrentlyBlocked && (billingSnapshot.hasAnyConfirmedPayment || billingSnapshot.hasActiveSubscription)) {
            console.warn(`[AUTH_SYNC] Assinatura/Pagamento encontrado, mas é antigo (anterior ao bloqueio). Ignorando ativação para companyId=${companyId}.`);
        } else if (requireCurrentMonthPayment) {
            console.warn(`[AUTH_SYNC] Nenhum pagamento confirmado no mês atual ou nos últimos 35 dias para companyId=${companyId}.`);
        } else {
            console.warn(`[AUTH_SYNC] Nenhum pagamento confirmado elegível para companyId=${companyId}.`);
        }
        return null;
    }

    const paymentDate = billingSnapshot.latestPaymentDate || billingSnapshot.subscriptionBaseDate || new Date();
    const nextDue = new Date(paymentDate);
    nextDue.setDate(nextDue.getDate() + 30);

    await db.update(schema.companies)
        .set({
            subscriptionStatus: "active",
            active: true,
            accessType: "automatic",
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
}

export const authPlugin = new Elysia({ name: "auth-plugin" })
    .derive({ as: 'global' }, async ({ request, path, set }) => {
        const isAuthRoute =
            path.startsWith("/api/auth") ||
            path.startsWith("/sign-in") ||
            path.startsWith("/sign-out") ||
            path === "/get-session" ||
            path === "/session" ||
            path === "/api/business/settings/pricing";

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
                    if (user.active === false && !isMasterRoute && !isAuthRoute && !isHealthRoute && user.role !== "SUPER_ADMIN") {
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
                        if (userCompany.active === false && !isMasterRoute && !isAuthRoute && !isHealthRoute && user.role !== "SUPER_ADMIN") {
                            const isAutomaticBillingBlocked =
                                userCompany.accessType === "automatic" &&
                                (
                                    userCompany.subscriptionStatus === "past_due" ||
                                    userCompany.subscriptionStatus === "inactive" ||
                                    userCompany.subscriptionStatus === "canceled"
                                );
                            if (isAutomaticBillingBlocked) {
                                const syncResult = await syncAsaasPaymentForCompany(
                                    userCompany.id,
                                    userCompany.ownerId,
                                    user.email,
                                    { requireCurrentMonthPayment: true },
                                );
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
                                console.warn(`[AUTH_BLOCK]: Estabelecimento bloqueado manualmente: ${userCompany.slug}`);
                                set.status = 403;
                                throw new Error("BUSINESS_SUSPENDED");
                            }
                        }

                        // Cálculo de dias restantes (Trial)
                        const now = new Date();
                        let daysLeft = 0;
                        if (userCompany.trialEndsAt) {
                            const end = new Date(userCompany.trialEndsAt);
                            const diffTime = end.getTime() - now.getTime();
                            daysLeft = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
                        }

                        // INJEÇÃO CRÍTICA: Garante que o objeto user tenha os dados do business e daysLeft
                        user.business = {
                            ...userCompany,
                            daysLeft
                        };
                        user.slug = userCompany.slug; // Fundamental para o redirecionamento no Front
                        user.businessId = userCompany.id;

                        // 2. BLOQUEIO POR ASSINATURA (SaaS)
                        // Verifica se o usuário tem permissão de acesso baseado na assinatura
                        if (!isMasterRoute && !isAuthRoute && !isHealthRoute && user.role !== "SUPER_ADMIN") {
                            const now = new Date();
                            let status = userCompany.subscriptionStatus;
                            const trialEnds = userCompany.trialEndsAt ? new Date(userCompany.trialEndsAt) : null;
                            const isTrialStatus = status === 'trial' || status === 'trialing';
                            let isManualActive =
                                userCompany.accessType === "manual" ||
                                status === 'manual' ||
                                status === 'manual_active';

                            if (isManualActive && trialEnds && trialEnds <= now) {
                                console.warn(`[AUTH_UPDATE]: Acesso Manual expirado para ${userCompany.slug}. Revertendo para 'past_due' (Automático).`);
                                await db.update(schema.companies)
                                    .set({
                                        subscriptionStatus: 'past_due',
                                        accessType: 'automatic'
                                    })
                                    .where(eq(schema.companies.id, userCompany.id));
                                status = "past_due";
                                isManualActive = false;
                            }

                            const isAutomaticAccess = userCompany.accessType === "automatic" && !isTrialStatus && !isManualActive;
                            if (isAutomaticAccess) {
                                const syncResult = await syncAsaasPaymentForCompany(
                                    userCompany.id,
                                    userCompany.ownerId,
                                    user.email,
                                    { requireCurrentMonthPayment: true },
                                );
                                if (syncResult?.activated) {
                                    status = "active";
                                    userCompany.subscriptionStatus = "active";
                                    userCompany.trialEndsAt = syncResult.nextDue;
                                    console.log(`[AUTH_SYNC] Pagamento confirmado no Asaas para ${userCompany.slug}. Acesso reativado automaticamente.`);
                                } else if (status === "active") {
                                    await db.update(schema.companies)
                                        .set({
                                            subscriptionStatus: "past_due",
                                            updatedAt: new Date(),
                                        })
                                        .where(eq(schema.companies.id, userCompany.id));
                                    status = "past_due";
                                    userCompany.subscriptionStatus = "past_due";
                                    console.warn(`[AUTH_SYNC] Sem pagamento válido no mês atual para ${userCompany.slug}. Rebaixado para past_due.`);
                                }
                            }

                            if (status === 'past_due' || status === 'inactive' || status === 'canceled') {
                                console.warn(`[AUTH_BLOCK]: Acesso negado por status inválido (${status}): ${userCompany.slug}`);
                                set.status = 402;
                                throw new Error("BILLING_REQUIRED");
                            }

                            const isActive = status === 'active';
                            const isTrialValid = isTrialStatus && trialEnds && trialEnds > now;

                            // 2. Auto-expiração do Trial (Lazy Update)
                            if (isTrialStatus && trialEnds && trialEnds <= now) {
                                console.warn(`[AUTH_UPDATE]: Trial expirado para ${userCompany.slug}. Atualizando status para 'past_due'.`);
                                await db.update(schema.companies)
                                    .set({ subscriptionStatus: 'past_due' })
                                    .where(eq(schema.companies.id, userCompany.id));
                                set.status = 402;
                                throw new Error("BILLING_REQUIRED");
                            }

                            if (!isManualActive && !isActive && !isTrialValid) {
                                console.warn(`[AUTH_BLOCK]: Acesso negado por falta de pagamento/trial expirado: ${userCompany.slug} (Status: ${status})`);
                                set.status = 402; // Payment Required
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
