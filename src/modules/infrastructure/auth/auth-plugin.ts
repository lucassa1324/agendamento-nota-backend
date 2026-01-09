import { Elysia } from "elysia";
import { auth } from "./auth";

export type User = typeof auth.$Infer.Session.user;
export type Session = typeof auth.$Infer.Session.session;

export const authPlugin = new Elysia({ name: "auth-plugin" })
    .derive({ as: 'global' }, async ({ request: { headers } }) => {
        const session = await auth.api.getSession({
            headers,
        });

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
