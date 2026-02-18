export class ListProductsUseCase {
    constructor(inventoryRepository, businessRepository) {
        this.inventoryRepository = inventoryRepository;
        this.businessRepository = businessRepository;
    }
    async execute(companyId, userId) {
        const business = await this.businessRepository.findById(companyId);
        if (!business || business.ownerId !== userId) {
            throw new Error("Unauthorized: You do not own this business");
        }
        const products = await this.inventoryRepository.findByCompanyId(companyId);
        return products || [];
    }
}
