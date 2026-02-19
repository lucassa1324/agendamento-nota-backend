import { Elysia } from "elysia";
import { db } from "../drizzle/database";
import * as schema from "../../../db/schema";
import { eq } from "drizzle-orm";
import { auth } from "./auth";
export const authPlugin = new Elysia({ name: "auth-plugin" })
    .derive({ as: 'global' }, async ({ request, path, set }) => {
    try {
        // Exceção para rotas do Master Admin
        const isMasterRoute = path.startsWith("/api/admin/master");
        const isAuthRoute = path.startsWith("/api/auth");
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
        let user = null;
        let session = null;
        const authSession = await auth.api.getSession({
            headers: headers,
        });
        if (authSession) {
            user = authSession.user;
            session = authSession.session;
        }
        else {
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
                }
                else {
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
                }
                else {
                    console.log(`>>> [AUTH_DEBUG] NO BUSINESS FOUND for this user.`);
                }
                // 1. BLOQUEIO POR CONTA DE USUÁRIO DESATIVADA (Restritivo)
                if (user.active === false && !isMasterRoute && !isAuthRoute && user.role !== "SUPER_ADMIN") {
                    console.warn(`[AUTH_BLOCK]: Conta de usuário desativada: ${user.email}`);
                    set.status = 403;
                    throw new Error("ACCOUNT_SUSPENDED");
                }
                if (userCompany) {
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
                    // 2. BLOQUEIO POR ESTÚDIO (BUSINESS) DESATIVADO (Restritivo)
                    // Se o status for explicitamente false, bloqueia.
                    if (userCompany.active === false && !isMasterRoute && !isAuthRoute && user.role !== "SUPER_ADMIN") {
                        console.warn(`[AUTH_BLOCK]: Acesso negado para estúdio suspenso: ${userCompany.slug} (User: ${user.email})`);
                        set.status = 403;
                        throw new Error("BUSINESS_SUSPENDED");
                    }
                    // 3. BLOQUEIO POR ASSINATURA (SaaS)
                    // Verifica se o usuário tem permissão de acesso baseado na assinatura
                    if (!isMasterRoute && !isAuthRoute && user.role !== "SUPER_ADMIN") {
                        const now = new Date();
                        const status = userCompany.subscriptionStatus;
                        const trialEnds = userCompany.trialEndsAt ? new Date(userCompany.trialEndsAt) : null;
                        // 🚨 BLOQUEIO EXPLÍCITO DE INADIMPLÊNCIA (PAST_DUE)
                        // Se o status for 'past_due', bloqueia imediatamente, ignorando datas.
                        // Isso garante que resets manuais para 'Automático' (que setam past_due) funcionem na hora.
                        if (status === 'past_due' || status === 'inactive' || status === 'canceled') {
                            console.warn(`[AUTH_BLOCK]: Acesso negado por status inválido (${status}): ${userCompany.slug}`);
                            set.status = 402;
                            throw new Error("BILLING_REQUIRED");
                        }
                        const isActive = status === 'active';
                        const isTrialValid = status === 'trial' && trialEnds && trialEnds > now;
                        // Adicionando 'manual' como status válido (usado no master-admin.controller.ts)
                        let isManualActive = status === 'manual' || status === 'manual_active';
                        // 1. Auto-expiração do Manual (Lazy Update)
                        // Se o acesso manual venceu, ele deve "voltar para o automático" (bloqueio se não pagou)
                        if (isManualActive && trialEnds && trialEnds <= now) {
                            console.warn(`[AUTH_UPDATE]: Acesso Manual expirado para ${userCompany.slug}. Revertendo para 'past_due' (Automático).`);
                            db.update(schema.companies)
                                .set({
                                subscriptionStatus: 'past_due',
                                accessType: 'automatic'
                            })
                                .where(eq(schema.companies.id, userCompany.id))
                                .then(() => console.log(`[AUTH_UPDATE_SUCCESS]: Reset de Manual para Automático/PastDue - ${userCompany.slug}`))
                                .catch(err => console.error(`[AUTH_UPDATE_ERROR]: Falha ao resetar status - ${userCompany.slug}`, err));
                            isManualActive = false; // Invalida o acesso manual para cair no bloqueio abaixo
                        }
                        // 2. Auto-expiração do Trial (Lazy Update)
                        if (status === 'trial' && trialEnds && trialEnds <= now) {
                            console.warn(`[AUTH_UPDATE]: Trial expirado para ${userCompany.slug}. Atualizando status para 'past_due'.`);
                            // Atualiza no banco de forma assíncrona
                            db.update(schema.companies)
                                .set({ subscriptionStatus: 'past_due' })
                                .where(eq(schema.companies.id, userCompany.id))
                                .then(() => console.log(`[AUTH_UPDATE_SUCCESS]: Status atualizado para 'past_due' - ${userCompany.slug}`))
                                .catch(err => console.error(`[AUTH_UPDATE_ERROR]: Falha ao atualizar status - ${userCompany.slug}`, err));
                            // Bloqueia imediatamente após detectar a expiração
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
            }
            catch (dbError) {
                if (dbError.message === "BUSINESS_SUSPENDED" || dbError.message === "BILLING_REQUIRED") {
                    throw dbError;
                }
                console.error(`[AUTH_PLUGIN] Erro ao buscar company:`, dbError);
            }
        }
        return {
            user: user,
            session: session,
        };
    }
    catch (error) {
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
