import { SettingsRepository } from "../../domain/ports/settings.repository";
import { SiteCustomization } from "../../../business/domain/types/site_customization.types";
import { GetSiteCustomizationUseCase } from "./get-site-customization.use-case";

export class UpdateSiteCustomizationUseCase {
  constructor(
    private settingsRepository: SettingsRepository,
    private getSiteCustomizationUseCase: GetSiteCustomizationUseCase
  ) { }

  async execute(businessId: string, partialData: any): Promise<SiteCustomization> {
    const current = await this.getSiteCustomizationUseCase.execute(businessId);

    // Mapeamento manual de snake_case para camelCase se necessário
    const normalizedData = this.normalizeKeys(partialData);
    const merged = this.deepMerge(current, normalizedData);

    return await this.settingsRepository.saveCustomization(businessId, merged);
  }

  private normalizeKeys(obj: any): any {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;

    const normalized: any = {};
    const mappings: Record<string, string> = {
      'layout_global': 'layoutGlobal',
      'site_colors': 'siteColors',
      'base_colors': 'siteColors',
      'text_colors': 'textColors',
      'action_buttons': 'actionButtons',
      'about_us': 'aboutUs',
      'appointment_flow': 'appointmentFlow',
      'step1_services': 'step1Services',
      'step1_service': 'step1Services',
      'step1Service': 'step1Services',
      'service': 'step1Services',
      'step3_time': 'step3Times',
      'step3Time': 'step3Times',
      'step3Times': 'step3Times',
      'slot_interval': 'timeSlotSize',
      'timeSlotSize': 'timeSlotSize',
      'time_slot_size': 'timeSlotSize',
      'card_config': 'cardConfig',
      'card_bg_color': 'backgroundColor',
      'cardBgColor': 'backgroundColor',
      'background_color': 'backgroundColor',
      'hero_banner': 'heroBanner',
      'hero': 'heroBanner',
      'services': 'servicesSection',
      'services_section': 'servicesSection',
      'values': 'valuesSection',
      'values_section': 'valuesSection',
      'gallery': 'galleryPreview',
      'gallery_preview': 'galleryPreview',
      'cta': 'ctaSection',
      'cta_section': 'ctaSection',
      'background_and_effect': 'backgroundAndEffect',
      'text_colors_header': 'textColors',
      'action_buttons_header': 'actionButtons'
    };

    for (const key in obj) {
      let targetKey = mappings[key] || key;
      let value = obj[key];

      // Caso especial: normalização de intervalo de tempo para número
      if (targetKey === 'timeSlotSize' && typeof value === 'string') {
        const parsed = parseInt(value, 10);
        if (!isNaN(parsed)) {
          console.log(`>>> [NORMALIZE] Convertendo timeSlotSize de string para número: ${value} -> ${parsed}`);
          value = parsed;
        }
      }

      // Caso especial: se a chave for 'cardBgColor' e estivermos no nível que deveria ter 'cardConfig'
      // ou se o valor for uma string (cor), mas a chave sugere que deveria estar dentro de cardConfig
      if (key === 'cardBgColor' || key === 'card_bg_color') {
        console.log(`>>> [NORMALIZE] Remapeando ${key} para cardConfig.backgroundColor`);
        normalized['cardConfig'] = {
          ...normalized['cardConfig'],
          backgroundColor: value
        };
        continue;
      }

      // Caso especial: normalização de cores genéricas para campos específicos do contrato
      if (key === 'color' && !mappings[key]) {
        normalized['textColor'] = value;
        // Não damos continue aqui para permitir que 'color' ainda exista se necessário, 
        // mas o contrato prefere 'textColor'
      }

      if (key === 'bgColor' && !mappings[key]) {
        normalized['backgroundColor'] = value;
      }

      normalized[targetKey] = this.normalizeKeys(value);
    }
    return normalized;
  }

  private deepMerge(target: any, source: any): any {
    const result = { ...target };

    for (const key in source) {
      if (source[key] === undefined) continue;

      // Prevenção de Esvaziamento: Se o valor for um objeto vazio, não faz merge
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (Object.keys(source[key]).length === 0) {
          console.log(`[DEEP_MERGE] Ignorando objeto vazio para chave: ${key}`);
          continue;
        }

        if (!result[key] || typeof result[key] !== 'object') result[key] = {};
        result[key] = this.deepMerge(result[key], source[key]);
      } else {
        result[key] = source[key];
      }
    }

    return result;
  }
}
