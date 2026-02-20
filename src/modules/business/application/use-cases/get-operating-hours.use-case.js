export class GetOperatingHoursUseCase {
    constructor(businessRepository) {
        this.businessRepository = businessRepository;
    }
    async execute(companyId, userId) {
        const result = await this.businessRepository.getOperatingHours(companyId, userId);
        if (!result) {
            throw new Error("Unauthorized or company not found");
        }
        return result;
    }
}
