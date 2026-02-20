export class SaveSettingsUseCase {
    constructor(settingsRepository) {
        this.settingsRepository = settingsRepository;
    }
    async execute(businessId, data) {
        return this.settingsRepository.upsert(businessId, data);
    }
}
