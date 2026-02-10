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

    /**
     * FORÇAR ENTREGA (timeSlotSize como Número):
     * O site oficial exige que este campo seja um número dentro de step3Times.
     */
    if (merged.appointmentFlow?.step3Times) {
      const size = merged.appointmentFlow.step3Times.timeSlotSize;
      merged.appointmentFlow.step3Times.timeSlotSize = typeof size === 'string' ? parseInt(size, 10) : Number(size || 30);

      console.log('>>> [PUBLIC_API_SEND] Enviando intervalo para o site:', merged.appointmentFlow.step3Times.timeSlotSize);
    }

    /**
     * DEBUG DE AGENDAMENTO (LOG):
     * Monitora o intervalo de tempo enviado para o front-end
     */
    console.log(`>>> [BOOKING_DEBUG] Intervalo de agendamento (timeSlotSize) para businessId ${businessId}: ${merged.appointmentFlow?.step3Times?.timeSlotSize} min`);

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
