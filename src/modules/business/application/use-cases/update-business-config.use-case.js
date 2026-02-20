export class UpdateBusinessConfigUseCase {
    constructor(businessRepository) {
        this.businessRepository = businessRepository;
    }
    async execute(id, userId, data) {
        const updatedBusiness = await this.businessRepository.updateConfig(id, userId, data.config);
        if (!updatedBusiness) {
            throw new Error("Business not found or unauthorized");
        }
        return updatedBusiness;
    }
}
