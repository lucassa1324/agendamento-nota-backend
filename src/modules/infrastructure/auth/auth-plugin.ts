import { Elysia } from "elysia";
import { auth } from "./auth";

import { eq } from "drizzle-orm";
import * as schema from "../../../db/schema";
import { db } from "../drizzle/database";

export type User = typeof auth.$Infer.Session.user;
export type Session = typeof auth.$Infer.Session.session;

export const authPlugin = new Elysia({ name: "auth-plugin" })
    .derive({ as: 'global' }, async ({ request }) => {
        const session = await auth.api.getSession({
            headers: request.headers,
        });

        if (session) {
            console.log(`[AUTH_PLUGIN] Sessão validada via Cookie para: ${session.user.email}`);
        } else {
            const url = new URL(request.url);
            if (!url.pathname.includes("/get-session") && !url.pathname.includes("/sign-in")) {
                console.log(`[AUTH_PLUGIN] Nenhuma sessão encontrada via Cookie para: ${url.pathname}`);
            }
        }

        return {
            user: session?.user ?? null,
            session: session?.session ?? null,
        };
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
