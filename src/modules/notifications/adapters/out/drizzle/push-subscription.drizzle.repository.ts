import { db } from "../../../../infrastructure/drizzle/database";
import { pushSubscriptions } from "../../../../../db/schema";
import { eq } from "drizzle-orm";
import { IPushSubscriptionRepository, PushSubscription } from "../../../domain/ports/push-subscription.repository";

export class DrizzlePushSubscriptionRepository implements IPushSubscriptionRepository {
  async upsert(userId: string, endpoint: string, p256dh: string, auth: string): Promise<PushSubscription> {
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
      return updated as PushSubscription;
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

    return inserted as PushSubscription;
  }

  async findAllByUserId(userId: string): Promise<PushSubscription[]> {
    const rows = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId));
    return rows as PushSubscription[];
  }

  async findByEndpoint(endpoint: string): Promise<PushSubscription | null> {
    const [row] = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, endpoint))
      .limit(1);
    return (row as PushSubscription) || null;
  }

  async deleteById(id: string): Promise<void> {
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, id));
  }

  async deleteByEndpoint(endpoint: string): Promise<void> {
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
  }
}
