import { db } from "../../../../infrastructure/drizzle/database";
import { businessProfiles, companySiteCustomizations, siteDrafts } from "../../../../../db/schema";
import { eq } from "drizzle-orm";
import { SettingsRepository, BusinessProfile } from "../../../domain/ports/settings.repository";
import { SiteCustomization } from "../../../../../modules/business/domain/types/site_customization.types";
import {
  DEFAULT_LAYOUT_GLOBAL,
  DEFAULT_HOME_SECTION,
  DEFAULT_GALLERY_SECTION,
  DEFAULT_ABOUT_US_SECTION,
  DEFAULT_APPOINTMENT_FLOW_SECTION
} from "../../../../../modules/business/domain/constants/site_customization.defaults";

export class DrizzleSettingsRepository implements SettingsRepository {
  private resolvePreferredCardColor(record: Record<string, any>): string | undefined {
    const cardConfig =
      record.cardConfig && typeof record.cardConfig === "object"
        ? (record.cardConfig as Record<string, any>)
        : {};
    const appearance =
      record.appearance && typeof record.appearance === "object"
        ? (record.appearance as Record<string, any>)
        : {};

    const candidates = [
      record.cardBgColor,
      record.card_bg_color,
      record.card_background_color,
      record.cardBackgroundColor,
      cardConfig.cardBgColor,
      cardConfig.card_bg_color,
      cardConfig.card_background_color,
      cardConfig.cardBackgroundColor,
      cardConfig.backgroundColor,
      cardConfig.background_color,
      appearance.cardBgColor,
      appearance.card_bg_color,
      appearance.card_background_color,
      appearance.cardBackgroundColor,
    ];

    const firstValid = candidates.find(
      (value) => typeof value === "string" && value.trim().length > 0,
    );

    return typeof firstValid === "string" ? firstValid : undefined;
  }

  private normalizeCardColorAliases<T>(value: T): T {
    if (Array.isArray(value)) {
      return value.map((item) => this.normalizeCardColorAliases(item)) as T;
    }

    if (!value || typeof value !== "object") {
      return value;
    }

    const source = value as Record<string, any>;
    const normalized: Record<string, any> = {};
    for (const key in source) {
      normalized[key] = this.normalizeCardColorAliases(source[key]);
    }

    const preferredCardColor = this.resolvePreferredCardColor(normalized);
    if (!preferredCardColor) {
      return normalized as T;
    }

    normalized.cardBgColor = preferredCardColor;
    normalized.cardBackgroundColor = preferredCardColor;
    normalized.card_bg_color = preferredCardColor;
    normalized.card_background_color = preferredCardColor;

    if (normalized.cardConfig && typeof normalized.cardConfig === "object") {
      normalized.cardConfig = {
        ...(normalized.cardConfig as Record<string, any>),
        cardBgColor: preferredCardColor,
        cardBackgroundColor: preferredCardColor,
        card_bg_color: preferredCardColor,
        card_background_color: preferredCardColor,
        backgroundColor: preferredCardColor,
        background_color: preferredCardColor,
      };
    }

    if (normalized.appearance && typeof normalized.appearance === "object") {
      normalized.appearance = {
        ...(normalized.appearance as Record<string, any>),
        cardBgColor: preferredCardColor,
        cardBackgroundColor: preferredCardColor,
        card_bg_color: preferredCardColor,
        card_background_color: preferredCardColor,
      };
    }

    return normalized as T;
  }

  private normalizeCustomizationForPersistence(data: {
    layoutGlobal: unknown;
    home: unknown;
    gallery: unknown;
    aboutUs: unknown;
    appointmentFlow: unknown;
  }) {
    return {
      layoutGlobal: this.normalizeCardColorAliases(data.layoutGlobal),
      home: this.normalizeCardColorAliases(data.home),
      gallery: this.normalizeCardColorAliases(data.gallery),
      aboutUs: this.normalizeCardColorAliases(data.aboutUs),
      appointmentFlow: this.normalizeCardColorAliases(data.appointmentFlow),
    };
  }

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

  private sanitizeCustomization(data: any): SiteCustomization {
    if (!data) return data;

    const sanitizeValue = (val: any): any => {
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        // Se for um objeto com a chave 'text', extraímos apenas o texto (camada de proteção)
        if (Object.keys(val).length === 1 && val.hasOwnProperty('text') && typeof val.text === 'string') {
          return val.text;
        }

        // Recursão para o resto do objeto
        const newObj: any = {};
        for (const key in val) {
          newObj[key] = sanitizeValue(val[key]);
        }
        return newObj;
      }
      return val;
    };

    // 1. BLINDAGEM: Preservar todos os campos originais (incluindo seções dinâmicas)
    // Isso evita regressões quando novos setores são adicionados no frontend.
    const sanitized: any = {};
    for (const key in data) {
      // Ignorar campos internos do banco de dados
      if (['id', 'companyId', 'createdAt', 'updatedAt'].includes(key)) continue;
      sanitized[key] = sanitizeValue(data[key]);
    }

    // 2. Garantir que as seções básicas tenham ao menos um fallback para não quebrar o frontend
    return {
      layoutGlobal: sanitized.layoutGlobal || DEFAULT_LAYOUT_GLOBAL,
      home: sanitized.home || DEFAULT_HOME_SECTION,
      gallery: sanitized.gallery || DEFAULT_GALLERY_SECTION,
      aboutUs: sanitized.aboutUs || DEFAULT_ABOUT_US_SECTION,
      appointmentFlow: sanitized.appointmentFlow || DEFAULT_APPOINTMENT_FLOW_SECTION,
      ...sanitized, // Spread final para garantir que campos extras (como 'sections') sejam mantidos
    } as SiteCustomization;
  }

  async findCustomizationByBusinessId(businessId: string): Promise<SiteCustomization | null> {
    try {
      const [result] = await db
        .select()
        .from(companySiteCustomizations)
        .where(eq(companySiteCustomizations.companyId, businessId))
        .limit(1);

      const defaultCustomization: SiteCustomization = {
        layoutGlobal: DEFAULT_LAYOUT_GLOBAL,
        home: DEFAULT_HOME_SECTION,
        gallery: DEFAULT_GALLERY_SECTION,
        aboutUs: DEFAULT_ABOUT_US_SECTION,
        appointmentFlow: DEFAULT_APPOINTMENT_FLOW_SECTION,
      };

      if (!result) {
        return defaultCustomization;
      }

      return this.sanitizeCustomization(result);
    } catch (error: any) {
      console.error("[DRIZZLE_SETTINGS_REPOSITORY_FINDCUSTOMIZATION_ERROR]:", error);
      throw error;
    }
  }

  async saveCustomization(businessId: string, data: SiteCustomization): Promise<SiteCustomization> {
    try {
      // 1. BLINDAGEM: Garantir apenas colunas mapeadas no schema (Evita Erro 500 por colunas extras)
      const dataToSave = this.normalizeCustomizationForPersistence({
        layoutGlobal: data.layoutGlobal || DEFAULT_LAYOUT_GLOBAL,
        home: data.home || DEFAULT_HOME_SECTION,
        gallery: data.gallery || DEFAULT_GALLERY_SECTION,
        aboutUs: data.aboutUs || DEFAULT_ABOUT_US_SECTION,
        appointmentFlow: data.appointmentFlow || DEFAULT_APPOINTMENT_FLOW_SECTION,
      });

      const [existing] = await db
        .select()
        .from(companySiteCustomizations)
        .where(eq(companySiteCustomizations.companyId, businessId))
        .limit(1);

      if (existing) {
        console.log(`[DRIZZLE_REPOSITORY] Atualizando customização existente para companyId: ${businessId}`);

        const [updated] = await db
          .update(companySiteCustomizations)
          .set({
            ...dataToSave,
            updatedAt: new Date(),
          })
          .where(eq(companySiteCustomizations.companyId, businessId))
          .returning();

        if (!updated) {
          throw new Error("Falha ao atualizar customização: nenhum registro retornado.");
        }

        return this.sanitizeCustomization(updated);
      } else {
        console.log(`[DRIZZLE_REPOSITORY] Criando nova customização para companyId: ${businessId}`);
        const [created] = await db
          .insert(companySiteCustomizations)
          .values({
            id: crypto.randomUUID(),
            companyId: businessId,
            ...dataToSave,
          })
          .returning();

        if (!created) {
          throw new Error("Falha ao criar customização: nenhum registro retornado.");
        }

        return this.sanitizeCustomization(created);
      }
    } catch (error: any) {
      console.error("[DRIZZLE_SETTINGS_REPOSITORY_SAVECUSTOMIZATION_ERROR]:", error);
      throw error;
    }
  }

  async findDraftByBusinessId(businessId: string): Promise<SiteCustomization | null> {
    try {
      const [result] = await db
        .select()
        .from(siteDrafts)
        .where(eq(siteDrafts.companyId, businessId))
        .limit(1);

      if (!result) {
        return {
          layoutGlobal: DEFAULT_LAYOUT_GLOBAL,
          home: DEFAULT_HOME_SECTION,
          gallery: DEFAULT_GALLERY_SECTION,
          aboutUs: DEFAULT_ABOUT_US_SECTION,
          appointmentFlow: DEFAULT_APPOINTMENT_FLOW_SECTION,
        } as SiteCustomization;
      }

      return this.sanitizeCustomization(result);
    } catch (error: any) {
      console.error("[DRIZZLE_SETTINGS_REPOSITORY_FINDDRAFT_ERROR]:", error);
      throw error;
    }
  }

  async saveDraft(businessId: string, data: SiteCustomization): Promise<SiteCustomization> {
    try {
      // 1. BLINDAGEM: Garantir apenas colunas mapeadas no schema (Evita Erro 500 por colunas extras)
      const dataToSave = this.normalizeCustomizationForPersistence({
        layoutGlobal: data.layoutGlobal || DEFAULT_LAYOUT_GLOBAL,
        home: data.home || DEFAULT_HOME_SECTION,
        gallery: data.gallery || DEFAULT_GALLERY_SECTION,
        aboutUs: data.aboutUs || DEFAULT_ABOUT_US_SECTION,
        appointmentFlow: data.appointmentFlow || DEFAULT_APPOINTMENT_FLOW_SECTION,
      });

      const existing = await this.findDraftByBusinessId(businessId);

      if (existing) {
        console.log(`[DRIZZLE_REPOSITORY] Atualizando draft existente para companyId: ${businessId}`);
        const [updated] = await db
          .update(siteDrafts)
          .set({
            ...dataToSave,
            updatedAt: new Date(),
          })
          .where(eq(siteDrafts.companyId, businessId))
          .returning();

        if (!updated) {
          throw new Error("Falha ao atualizar draft: nenhum registro retornado.");
        }

        return this.sanitizeCustomization(updated);
      }

      console.log(`[DRIZZLE_REPOSITORY] Criando novo draft para companyId: ${businessId}`);
      const [created] = await db
        .insert(siteDrafts)
        .values({
          id: crypto.randomUUID(),
          companyId: businessId,
          ...dataToSave,
        })
        .returning();

      if (!created) {
        throw new Error("Falha ao criar draft: nenhum registro retornado.");
      }

      return this.sanitizeCustomization(created);
    } catch (error: any) {
      console.error("[DRIZZLE_SETTINGS_REPOSITORY_SAVEDRAFT_ERROR]:", error);
      throw error;
    }
  }

  async publishDraft(businessId: string): Promise<SiteCustomization | null> {
    try {
      return await db.transaction(async (tx) => {
        const [draft] = await tx
          .select()
          .from(siteDrafts)
          .where(eq(siteDrafts.companyId, businessId))
          .limit(1);

        if (!draft) return null;

        // 1. BLINDAGEM: Garantir apenas colunas mapeadas no schema
        const dataToSave = this.normalizeCustomizationForPersistence({
          layoutGlobal: draft.layoutGlobal,
          home: draft.home,
          gallery: draft.gallery,
          aboutUs: draft.aboutUs,
          appointmentFlow: draft.appointmentFlow,
        });

        const [published] = await tx
          .insert(companySiteCustomizations)
          .values({
            id: crypto.randomUUID(),
            companyId: businessId,
            ...dataToSave,
          })
          .onConflictDoUpdate({
            target: companySiteCustomizations.companyId,
            set: {
              ...dataToSave,
              updatedAt: new Date(),
            },
          })
          .returning();

        if (!published) return null;

        return this.sanitizeCustomization(published);
      });
    } catch (error: any) {
      console.error("[DRIZZLE_SETTINGS_REPOSITORY_PUBLISHDRAFT_ERROR]:", error);
      throw error;
    }
  }

  async resetCustomization(businessId: string): Promise<SiteCustomization> {
    try {
      const defaultCustomization: SiteCustomization = {
        layoutGlobal: DEFAULT_LAYOUT_GLOBAL,
        home: DEFAULT_HOME_SECTION,
        gallery: DEFAULT_GALLERY_SECTION,
        aboutUs: DEFAULT_ABOUT_US_SECTION,
        appointmentFlow: DEFAULT_APPOINTMENT_FLOW_SECTION,
      };

      return await db.transaction(async (tx) => {
        // Remove draft se existir
        await tx
          .delete(siteDrafts)
          .where(eq(siteDrafts.companyId, businessId));

        // Upsert na customização principal com os valores padrão
        const [reseted] = await tx
          .insert(companySiteCustomizations)
          .values({
            id: crypto.randomUUID(),
            companyId: businessId,
            ...defaultCustomization,
          })
          .onConflictDoUpdate({
            target: companySiteCustomizations.companyId,
            set: {
              ...defaultCustomization,
              updatedAt: new Date(),
            },
          })
          .returning();

        if (!reseted) {
          throw new Error("Falha ao resetar customização: nenhum registro retornado.");
        }

        return this.sanitizeCustomization(reseted);
      });
    } catch (error: any) {
      console.error("[DRIZZLE_SETTINGS_REPOSITORY_RESET_ERROR]:", error);
      throw error;
    }
  }
}
