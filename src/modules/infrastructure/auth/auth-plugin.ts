import { Elysia } from "elysia";
import { db } from "../drizzle/database";
import * as schema from "../../../db/schema";
import { eq } from "drizzle-orm";
import { auth } from "./auth";

export type User = typeof auth.$Infer.Session.user & {
    business?: any;
    slug?: string;
    businessId?: string;
};

export type Session = typeof auth.$Infer.Session.session;

export const authPlugin = new Elysia({ name: "auth-plugin" })
    .derive({ as: 'global' }, async ({ request }) => {
        try {
            const authHeader = request.headers.get("authorization");
            const cookieHeader = request.headers.get("cookie");
            const headers = new Headers(request.headers);

            // Injeção de Token do Header para Cookie (suporte a Bearer Token)
            if (authHeader && authHeader.startsWith("Bearer ")) {
                const token = authHeader.substring(7).trim();
                
                // Better Auth espera o token no cookie com prefixo configurado ou padrão
                // Por padrão o better-auth usa 'better-auth.session_token'
                const cookieName = "better-auth.session_token";
                
                let cookieString = cookieHeader || "";
                if (!cookieString.includes(cookieName)) {
                    cookieString += (cookieString ? "; " : "") + `${cookieName}=${token}`;
                }
                headers.set("cookie", cookieString);
                console.log(`[AUTH_PLUGIN] Token injetado no cookie para validação do Better Auth`);
            }

            // Força o host para bater com o baseURL do Better Auth se necessário
            const baseURL = new URL(auth.options.baseURL || "http://localhost:3001");
            headers.set("host", baseURL.host);

            console.log(`[AUTH_PLUGIN] Verificando sessão para: ${request.url}`);
            // console.log(`[AUTH_PLUGIN] Headers enviados para getSession: ${JSON.stringify(Object.fromEntries(headers.entries()))}`);

            let user: any = null;
            let session: any = null;

            const authSession = await auth.api.getSession({
                headers: headers,
            });

            if (authSession) {
                console.log(`[AUTH_PLUGIN] Sessão validada via API para: ${authSession.user.email}`);
                user = authSession.user;
                session = authSession.session;
            } else {
                console.warn(`[AUTH_PLUGIN] API não validou sessão. Token presente: ${authHeader ? 'Sim' : 'Não'}. Tentando manual...`);

                if (authHeader && authHeader.startsWith("Bearer ")) {
                    const token = authHeader.substring(7).trim();
                    console.log(`[AUTH_PLUGIN] Buscando token/id no DB: ${token.substring(0, 10)}...`);
                    
                    // Tenta buscar por token OU por id (alguns clients mandam o session ID)
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
                            console.log(`[AUTH_PLUGIN] Sessão encontrada por ID.`);
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
                                console.log(`[AUTH_PLUGIN] Sucesso manual: ${userRow.email}`);
                                user = userRow;
                                session = sessionRow;
                            } else {
                                console.error(`[AUTH_PLUGIN] Usuário ${sessionRow.userId} não encontrado para sessão.`);
                            }
                        } else {
                            console.error(`[AUTH_PLUGIN] Sessão expirada em: ${expires.toISOString()} (Agora: ${now.toISOString()})`);
                        }
                    } else {
                        console.error(`[AUTH_PLUGIN] Token/ID '${token.substring(0, 10)}...' não encontrado no banco de dados.`);
                    }
                }
            }

            // Enriquecimento com dados do business (similar ao after hook do auth.ts)
            if (user && user.id) {
                try {
                    const businessResults = await db
                        .select({
                            id: schema.companies.id,
                            name: schema.companies.name,
                            slug: schema.companies.slug,
                            ownerId: schema.companies.ownerId,
                        })
                        .from(schema.companies)
                        .where(eq(schema.companies.ownerId, user.id))
                        .limit(1);

                    const userCompany = businessResults[0];
                    if (userCompany) {
                        user.business = userCompany;
                        user.slug = userCompany.slug;
                        user.businessId = userCompany.id;
                        console.log(`[AUTH_PLUGIN] Business vinculado encontrado: ${userCompany.slug} (${userCompany.id})`);
                    }
                } catch (dbError) {
                    console.error(`[AUTH_PLUGIN] Erro ao buscar company:`, dbError);
                }
            }

            if (user) {
                console.log(`[AUTH_PLUGIN] Finalizado: Usuário ${user.email} (Business: ${user.businessId || 'NENHUM'})`);
            } else {
                console.log(`[AUTH_PLUGIN] Finalizado: Sem usuário autenticado.`);
            }

            return {
                user: user as User | null,
                session: session as Session | null,
            };
        } catch (error) {
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
    });
