import { db } from "../../../../infrastructure/drizzle/database";
import { pushSubscriptions } from "../../../../../db/schema";
import { eq } from "drizzle-orm";
export class DrizzlePushSubscriptionRepository {
    async upsert(userId, endpoint, p256dh, auth) {
        const [existing] = await db
            .select()
            .from(pushSubscriptions)
            .where(eq(pushSubscriptions.endpoint, endpoint))
            .limit(1);
        if (existing) {
            const [updated] = await db
                .update(pushSubscriptions)
                .set({
                userId,
                p256dh,
                auth,
                updatedAt: new Date()
            })
                .where(eq(pushSubscriptions.endpoint, endpoint))
                .returning();
            return updated;
        }
        const [inserted] = await db
            .insert(pushSubscriptions)
            .values({
            id: crypto.randomUUID(),
            userId,
            endpoint,
            p256dh,
            auth
        })
            .returning();
        return inserted;
    }
    async findAllByUserId(userId) {
        const rows = await db
            .select()
            .from(pushSubscriptions)
            .where(eq(pushSubscriptions.userId, userId));
        return rows;
    }
    async findByEndpoint(endpoint) {
        const [row] = await db
            .select()
            .from(pushSubscriptions)
            .where(eq(pushSubscriptions.endpoint, endpoint))
            .limit(1);
        return row || null;
    }
    async deleteById(id) {
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, id));
    }
    async deleteByEndpoint(endpoint) {
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
    }
}
