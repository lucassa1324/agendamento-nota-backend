import { SettingsRepository } from "../../domain/ports/settings.repository";
import { SiteCustomization } from "../../../business/domain/types/site_customization.types";
import {
  DEFAULT_LAYOUT_GLOBAL,
  DEFAULT_HOME_SECTION,
  DEFAULT_GALLERY_SECTION,
  DEFAULT_ABOUT_US_SECTION,
  DEFAULT_APPOINTMENT_FLOW_SECTION,
} from "../../../business/domain/constants/site_customization.defaults";

export class GetSiteCustomizationUseCase {
  constructor(private settingsRepository: SettingsRepository) { }

  async execute(businessId: string): Promise<SiteCustomization> {
    const customization = await this.settingsRepository.findCustomizationByBusinessId(businessId);

    const defaultCustomization: SiteCustomization = {
      layoutGlobal: DEFAULT_LAYOUT_GLOBAL,
      home: DEFAULT_HOME_SECTION,
      gallery: DEFAULT_GALLERY_SECTION,
      aboutUs: DEFAULT_ABOUT_US_SECTION,
      appointmentFlow: DEFAULT_APPOINTMENT_FLOW_SECTION,
    };

    if (!customization) {
      console.log(`[GET_SITE_CUSTOMIZATION] Nenhum registro encontrado para businessId: ${businessId}. Criando padrão.`);
      // Create the default record in the database
      return await this.settingsRepository.saveCustomization(businessId, defaultCustomization);
    }

    console.log(`[GET_SITE_CUSTOMIZATION] Registro encontrado no banco para businessId: ${businessId}. Realizando merge para evitar nulos.`);

    // Realiza o merge profundo para garantir que campos novos ou nulos sejam preenchidos com os padrões
    const merged = this.deepMerge(defaultCustomization, customization);

    /**
     * CONTRATO DE DADOS (GET):
     * Estrutura: appointmentFlow -> step1Services (PLURAL) -> cardConfig -> backgroundColor
     * Propriedade: backgroundColor (camelCase)
     */
    if (merged.appointmentFlow?.step1Services?.cardConfig?.backgroundColor === "TRANSPARENT_DEFAULT") {
      merged.appointmentFlow.step1Services.cardConfig.backgroundColor = "#F3E2E2"; // Fallback real
    }

    console.log(`>>> [GET_SITE_CUSTOMIZATION] Contrato Validado: step1Services.cardConfig.backgroundColor = ${merged.appointmentFlow?.step1Services?.cardConfig?.backgroundColor}`);

    return merged;
  }

  private deepMerge(target: any, source: any): any {
    const result = { ...target };

    for (const key in source) {
      if (source[key] === null || source[key] === undefined) continue;

      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }

    return result;
  }
}
