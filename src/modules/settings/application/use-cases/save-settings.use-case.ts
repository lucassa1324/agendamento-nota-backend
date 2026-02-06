import { SettingsRepository, BusinessProfile } from "../../domain/ports/settings.repository";

export class SaveSettingsUseCase {
  constructor(private settingsRepository: SettingsRepository) { }

  async execute(businessId: string, data: Partial<Omit<BusinessProfile, "id" | "businessId" | "createdAt" | "updatedAt">>): Promise<BusinessProfile> {
    return this.settingsRepository.upsert(businessId, data);
  }
}
