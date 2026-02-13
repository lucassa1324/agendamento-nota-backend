import { Elysia } from "elysia";
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

            let user: any = null;
            let session: any = null;

            const authSession = await auth.api.getSession({
                headers: headers,
            });

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
                    const businessResults = await db
                        .select({
                            id: schema.companies.id,
                            name: schema.companies.name,
                            slug: schema.companies.slug,
                            ownerId: schema.companies.ownerId,
                            active: schema.companies.active,
                        })
                        .from(schema.companies)
                        .where(eq(schema.companies.ownerId, user.id))
                        .limit(1);

                    const userCompany = businessResults[0];
                    
                    // Log de depuração (Status: true/false ou undefined se não encontrar)
                    console.log(`>>> [CHECK_BLOQUEIO] User: ${user.email} | Active: ${user.active} | BusinessID: ${userCompany?.id} | Status: ${userCompany?.active}`);

                    // 1. BLOQUEIO POR CONTA DE USUÁRIO DESATIVADA (Restritivo)
                    if (user.active === false && !isMasterRoute && !isAuthRoute && user.role !== "SUPER_ADMIN") {
                        console.warn(`[AUTH_BLOCK]: Conta de usuário desativada: ${user.email}`);
                        
                        set.status = 403;
                        throw new Error("ACCOUNT_SUSPENDED");
                    }

                    if (userCompany) {
                        user.business = userCompany;
                        user.slug = userCompany.slug;
                        user.businessId = userCompany.id;

                        // 2. BLOQUEIO POR ESTÚDIO (BUSINESS) DESATIVADO (Restritivo)
                        // Se o status for explicitamente false, bloqueia.
                        if (userCompany.active === false && !isMasterRoute && !isAuthRoute && user.role !== "SUPER_ADMIN") {
                            console.warn(`[AUTH_BLOCK]: Acesso negado para estúdio suspenso: ${userCompany.slug} (User: ${user.email})`);
                            
                            set.status = 403;
                            throw new Error("BUSINESS_SUSPENDED");
                        }
                    }
                } catch (dbError: any) {
                    if (dbError.message === "BUSINESS_SUSPENDED") {
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
            if (error.message === "BUSINESS_SUSPENDED" || error.message === "ACCOUNT_SUSPENDED") {
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
