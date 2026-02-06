import { SettingsRepository, BusinessProfile } from "../../domain/ports/settings.repository";

export class GetSettingsUseCase {
  constructor(private settingsRepository: SettingsRepository) { }

  async execute(businessId: string): Promise<BusinessProfile | null> {
    return this.settingsRepository.findByBusinessId(businessId);
  }
}
