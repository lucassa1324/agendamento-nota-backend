import { db } from "../../../../infrastructure/drizzle/database";
import { businessProfiles, companySiteCustomizations } from "../../../../../db/schema";
import { eq } from "drizzle-orm";
import { SettingsRepository, BusinessProfile } from "../../../domain/ports/settings.repository";
import { SiteCustomization } from "../../../../../modules/business/domain/types/site_customization.types";

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

  async findCustomizationByBusinessId(businessId: string): Promise<SiteCustomization | null> {
    try {
      const [result] = await db
        .select()
        .from(companySiteCustomizations)
        .where(eq(companySiteCustomizations.companyId, businessId))
        .limit(1);

      if (!result) return null;

      return {
        layoutGlobal: result.layoutGlobal,
        home: result.home,
        gallery: result.gallery,
        aboutUs: result.aboutUs,
        appointmentFlow: result.appointmentFlow,
      } as SiteCustomization;
    } catch (error: any) {
      console.error("[DRIZZLE_SETTINGS_REPOSITORY_FINDCUSTOMIZATION_ERROR]:", error);
      throw error;
    }
  }

  async saveCustomization(businessId: string, data: SiteCustomization): Promise<SiteCustomization> {
    try {
      const existing = await this.findCustomizationByBusinessId(businessId);

      if (existing) {
        console.log(`[DRIZZLE_REPOSITORY] Atualizando customização existente para companyId: ${businessId}`);

        // Log de Persistência Temporário
        const newColor = (data as any).appointmentFlow?.step1Services?.cardConfig?.backgroundColor;
        if (newColor) {
          console.log(`>>> [DB_SAVE] Salvando cor ${newColor} para o campo appointmentFlow.step1Services.cardConfig.backgroundColor`);
        }

        const [updated] = await db
          .update(companySiteCustomizations)
          .set({
            ...data,
            updatedAt: new Date(),
          })
          .where(eq(companySiteCustomizations.companyId, businessId))
          .returning();

        if (!updated) {
          throw new Error("Falha ao atualizar customização: nenhum registro retornado.");
        }

        console.log(`>>> [DB_CONFIRM] Banco retornou objeto atualizado para ID: ${businessId}`);
        return {
          layoutGlobal: updated.layoutGlobal,
          home: updated.home,
          gallery: updated.gallery,
          aboutUs: updated.aboutUs,
          appointmentFlow: updated.appointmentFlow,
        } as SiteCustomization;
      } else {
        console.log(`[DRIZZLE_REPOSITORY] Criando nova customização para companyId: ${businessId}`);
        const [created] = await db
          .insert(companySiteCustomizations)
          .values({
            id: crypto.randomUUID(),
            companyId: businessId,
            ...data,
          })
          .returning();

        if (!created) {
          throw new Error("Falha ao criar customização: nenhum registro retornado.");
        }

        return {
          layoutGlobal: created.layoutGlobal,
          home: created.home,
          gallery: created.gallery,
          aboutUs: created.aboutUs,
          appointmentFlow: created.appointmentFlow,
        } as SiteCustomization;
      }
    } catch (error: any) {
      console.error("[DRIZZLE_SETTINGS_REPOSITORY_SAVECUSTOMIZATION_ERROR]:", error);
      throw error;
    }
  }
}
