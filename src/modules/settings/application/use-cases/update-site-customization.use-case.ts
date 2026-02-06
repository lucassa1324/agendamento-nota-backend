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

    console.log(`[UPDATE_SITE_CUSTOMIZATION] Objeto final após deep merge para businessId: ${businessId}`);
    console.dir(merged, { depth: null, colors: true });

    return await this.settingsRepository.saveCustomization(businessId, merged);
  }

  private normalizeKeys(obj: any): any {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;

    const normalized: any = {};
    const mappings: Record<string, string> = {
      'layout_global': 'layoutGlobal',
      'site_colors': 'siteColors',
      'base_colors': 'siteColors', // Suporte a variações
      'text_colors': 'textColors',
      'action_buttons': 'actionButtons',
      'about_us': 'aboutUs',
      'appointment_flow': 'appointmentFlow',
      'hero_banner': 'heroBanner',
      'services_section': 'servicesSection',
      'background_and_effect': 'backgroundAndEffect',
      'text_colors_header': 'textColors',
      'action_buttons_header': 'actionButtons'
    };

    for (const key in obj) {
      const targetKey = mappings[key] || key;
      normalized[targetKey] = this.normalizeKeys(obj[key]);
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
