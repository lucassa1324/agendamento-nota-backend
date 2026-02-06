import { db } from "../../../../infrastructure/drizzle/database";
import { businessProfiles } from "../../../../../db/schema";
import { eq } from "drizzle-orm";
import { SettingsRepository, BusinessProfile } from "../../../domain/ports/settings.repository";

export class DrizzleSettingsRepository implements SettingsRepository {
  async findByBusinessId(businessId: string): Promise<BusinessProfile | null> {
    try {
      const [result] = await db
        .select()
        .from(businessProfiles)
        .where(eq(businessProfiles.businessId, businessId))
        .limit(1);

      return (result as BusinessProfile) || null;
    } catch (error: any) {
      console.error("[DRIZZLE_SETTINGS_REPOSITORY_FINDBYBUSINESSID_ERROR]:", error);
      throw error;
    }
  }

  async upsert(businessId: string, data: Partial<Omit<BusinessProfile, "id" | "businessId" | "createdAt" | "updatedAt">>): Promise<BusinessProfile> {
    try {
      const existing = await this.findByBusinessId(businessId);

      if (existing) {
        const [updated] = await db
          .update(businessProfiles)
          .set({
            ...data,
            updatedAt: new Date(),
          })
          .where(eq(businessProfiles.businessId, businessId))
          .returning();

        return updated as BusinessProfile;
      } else {
        const [created] = await db
          .insert(businessProfiles)
          .values({
            id: crypto.randomUUID(),
            businessId,
            ...data,
          })
          .returning();

        return created as BusinessProfile;
      }
    } catch (error: any) {
      console.error("[DRIZZLE_SETTINGS_REPOSITORY_UPSERT_ERROR]:", error);
      throw error;
    }
  }
}
