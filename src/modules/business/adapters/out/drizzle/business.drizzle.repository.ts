import { db } from "../../../../infrastructure/drizzle/database";
import { business } from "../../../../../db/schema";
import { and, eq } from "drizzle-orm";
import { IBusinessRepository } from "../../../domain/ports/business.repository";
import { Business, BusinessSummary, CreateBusinessInput } from "../../../domain/entities/business.entity";

export class DrizzleBusinessRepository implements IBusinessRepository {
  async findAllByUserId(userId: string): Promise<BusinessSummary[]> {
    return await db
      .select({
        id: business.id,
        name: business.name,
        slug: business.slug,
        config: business.config,
        createdAt: business.createdAt,
      })
      .from(business)
      .where(eq(business.userId, userId));
  }

  async findBySlug(slug: string): Promise<Business | null> {
    const result = await db
      .select()
      .from(business)
      .where(eq(business.slug, slug))
      .limit(1);
    return result[0] || null;
  }

  async findById(id: string): Promise<Business | null> {
    const result = await db
      .select()
      .from(business)
      .where(eq(business.id, id))
      .limit(1);
    return result[0] || null;
  }

  async create(data: CreateBusinessInput): Promise<Business> {
    const result = await db.insert(business).values(data).returning();
    return result[0];
  }

  async updateConfig(id: string, userId: string, config: any): Promise<Business | null> {
    const result = await db
      .update(business)
      .set({ config })
      .where(and(eq(business.id, id), eq(business.userId, userId)))
      .returning();
    return result[0] || null;
  }
}
