import { Elysia } from "elysia";
import { db } from "../drizzle/database";
import * as schema from "../../../db/schema";
import { eq } from "drizzle-orm";
import { auth } from "./auth";

export type User = typeof auth.$Infer.Session.user;
export type Session = typeof auth.$Infer.Session.session;

export const authPlugin = new Elysia({ name: "auth-plugin" })
    .derive({ as: 'global' }, async ({ request }) => {
        try {
            const authHeader = request.headers.get("authorization");
            const cookieHeader = request.headers.get("cookie");
            const headers = new Headers(request.headers);

            // Força o host para bater com o baseURL do Better Auth se necessário
            const baseURL = new URL(auth.options.baseURL || "http://localhost:3001");
            headers.set("host", baseURL.host);

            console.log(`[AUTH_PLUGIN] Verificando sessão para: ${request.url}`);
            if (cookieHeader) {
                console.log(`[AUTH_PLUGIN] Cookies encontrados: ${cookieHeader.substring(0, 50)}...`);
            }

            if (authHeader && authHeader.startsWith("Bearer ")) {
                const token = authHeader.substring(7).trim();
                console.log(`[AUTH_PLUGIN] Token extraído de Header: ${token.substring(0, 5)}...`);

                const cookieNames = ["better-auth.session_token", "session_token", "better-auth.session-token"];
                let cookieString = headers.get("cookie") || "";

                for (const name of cookieNames) {
                    if (!cookieString.includes(name)) {
                        cookieString += (cookieString ? "; " : "") + `${name}=${token}`;
                    }
                }
                headers.set("cookie", cookieString);
                console.log(`[AUTH_PLUGIN] Headers de Cookie simulados: ${cookieString.substring(0, 50)}...`);
            }

            const session = await auth.api.getSession({
                headers: headers,
            });

            if (session) {
                console.log(`[AUTH_PLUGIN] Sessão validada com sucesso para: ${session.user.email}`);
            } else {
                console.warn(`[AUTH_PLUGIN] Falha na validação da sessão via API. Tentando busca manual no DB...`);

                if (authHeader && authHeader.startsWith("Bearer ")) {
                    const token = authHeader.substring(7).trim();
                    const results = await db
                        .select()
                        .from(schema.session)
                        .where(eq(schema.session.token, token))
                        .limit(1);

                    const sessionRow = results[0];

                    if (sessionRow && new Date(sessionRow.expiresAt) > new Date()) {
                        const userResults = await db
                            .select()
                            .from(schema.user)
                            .where(eq(schema.user.id, sessionRow.userId))
                            .limit(1);

                        const userRow = userResults[0];

                        if (userRow) {
                            console.log(`[AUTH_PLUGIN] Sessão validada MANUALMENTE no DB para: ${userRow.email}`);
                            return {
                                user: userRow,
                                session: sessionRow
                            };
                        }
                    } else {
                        console.error(`[AUTH_PLUGIN] Sessão não encontrada no banco ou expirada.`);
                    }
                }
            }

            return {
                user: session?.user ?? null,
                session: session?.session ?? null,
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
