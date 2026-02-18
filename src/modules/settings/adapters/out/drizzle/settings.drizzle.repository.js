import { db } from "../../../../infrastructure/drizzle/database";
import { businessProfiles, companySiteCustomizations } from "../../../../../db/schema";
import { eq } from "drizzle-orm";
export class DrizzleSettingsRepository {
    async findByBusinessId(businessId) {
        try {
            const [result] = await db
                .select()
                .from(businessProfiles)
                .where(eq(businessProfiles.businessId, businessId))
                .limit(1);
            return result || null;
        }
        catch (error) {
            console.error("[DRIZZLE_SETTINGS_REPOSITORY_FINDBYBUSINESSID_ERROR]:", error);
            throw error;
        }
    }
    async upsert(businessId, data) {
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
                return updated;
            }
            else {
                const [created] = await db
                    .insert(businessProfiles)
                    .values({
                    id: crypto.randomUUID(),
                    businessId,
                    ...data,
                })
                    .returning();
                return created;
            }
        }
        catch (error) {
            console.error("[DRIZZLE_SETTINGS_REPOSITORY_UPSERT_ERROR]:", error);
            throw error;
        }
    }
    async findCustomizationByBusinessId(businessId) {
        try {
            const [result] = await db
                .select()
                .from(companySiteCustomizations)
                .where(eq(companySiteCustomizations.companyId, businessId))
                .limit(1);
            if (!result)
                return null;
            return {
                layoutGlobal: result.layoutGlobal,
                home: result.home,
                gallery: result.gallery,
                aboutUs: result.aboutUs,
                appointmentFlow: result.appointmentFlow,
            };
        }
        catch (error) {
            console.error("[DRIZZLE_SETTINGS_REPOSITORY_FINDCUSTOMIZATION_ERROR]:", error);
            throw error;
        }
    }
    async saveCustomization(businessId, data) {
        try {
            const existing = await this.findCustomizationByBusinessId(businessId);
            if (existing) {
                console.log(`[DRIZZLE_REPOSITORY] Atualizando customização existente para companyId: ${businessId}`);
                // Log de Persistência Temporário
                const newColor = data.appointmentFlow?.step1Services?.cardConfig?.backgroundColor;
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
                };
            }
            else {
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
                };
            }
        }
        catch (error) {
            console.error("[DRIZZLE_SETTINGS_REPOSITORY_SAVECUSTOMIZATION_ERROR]:", error);
            throw error;
        }
    }
}
