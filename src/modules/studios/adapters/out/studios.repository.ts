import { db } from "../../../infrastructure/drizzle/database";
import { business } from "../../../../db/schema";
import { eq } from "drizzle-orm";

export class StudiosRepository {
  async findBySlug(slug: string) {
    const [record] = await db
      .select({
        id: business.id,
        name: business.name,
        slug: business.slug,
        ownerId: business.userId,
        config: business.config,
        createdAt: business.createdAt,
        updatedAt: business.updatedAt,
      })
      .from(business)
      .where(eq(business.slug, slug))
      .limit(1);
    return record ?? null;
  }

  async findById(id: string) {
    const [record] = await db
      .select()
      .from(business)
      .where(eq(business.id, id))
      .limit(1);
    return record ?? null;
  }
}
