export class GetSettingsUseCase {
    constructor(settingsRepository) {
        this.settingsRepository = settingsRepository;
    }
    async execute(businessId) {
        return this.settingsRepository.findByBusinessId(businessId);
    }
}
