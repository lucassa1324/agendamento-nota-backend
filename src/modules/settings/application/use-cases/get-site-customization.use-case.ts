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

    if (!customization) {
      console.log(`[GET_SITE_CUSTOMIZATION] Nenhum registro encontrado para businessId: ${businessId}. Criando padrão.`);
      const defaultCustomization: SiteCustomization = {
        layoutGlobal: DEFAULT_LAYOUT_GLOBAL,
        home: DEFAULT_HOME_SECTION,
        gallery: DEFAULT_GALLERY_SECTION,
        aboutUs: DEFAULT_ABOUT_US_SECTION,
        appointmentFlow: DEFAULT_APPOINTMENT_FLOW_SECTION,
      };

      // Create the default record in the database
      return await this.settingsRepository.saveCustomization(businessId, defaultCustomization);
    }

    console.log(`[GET_SITE_CUSTOMIZATION] Registro encontrado no banco para businessId: ${businessId}`);
    return customization;
  }
}
