import { Elysia } from "elysia";
import { auth } from "./auth";

import { eq } from "drizzle-orm";
import * as schema from "../../../db/schema";
import { db } from "../drizzle/database";

export type User = typeof auth.$Infer.Session.user;
export type Session = typeof auth.$Infer.Session.session;

export const authPlugin = new Elysia({ name: "auth-plugin" })
    .derive({ as: 'global' }, async ({ request }) => {
        try {
            // Tenta obter o token do Header Authorization caso não esteja nos cookies
            const authHeader = request.headers.get("authorization");
            const headers = new Headers(request.headers);

            if (authHeader && authHeader.startsWith("Bearer ")) {
                const token = authHeader.substring(7).trim(); // Remove 'Bearer ' e espaços extras
                console.log(`[AUTH_PLUGIN] Token extraído (tamanho: ${token.length}): "${token.substring(0, 10)}...${token.substring(token.length - 5)}"`);

                // O Better Auth usa session_token (com underline) por padrão, mesmo que a config use camelCase
                // Com o cookiePrefix "better-auth", o nome final é better-auth.session_token
                const cookieName = "better-auth.session_token";

                let cookieString = headers.get("cookie") || "";
                if (!cookieString.includes(cookieName)) {
                    cookieString = cookieString
                        ? `${cookieString}; ${cookieName}=${token}`
                        : `${cookieName}=${token}`;
                    headers.set("cookie", cookieString);
                }
            }

            const session = await auth.api.getSession({
                headers: headers,
            });

            if (session) {
                console.log(`[AUTH_PLUGIN] Sessão validada para: ${session.user.email} (${authHeader ? 'Header' : 'Cookie'})`);
            } else if (authHeader) {
                console.warn(`[AUTH_PLUGIN] Token enviado mas sessão NÃO validada pelo Better Auth`);
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
