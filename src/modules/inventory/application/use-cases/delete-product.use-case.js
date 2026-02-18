export class DeleteProductUseCase {
    constructor(inventoryRepository, businessRepository) {
        this.inventoryRepository = inventoryRepository;
        this.businessRepository = businessRepository;
    }
    async execute(id, userId) {
        const product = await this.inventoryRepository.findById(id);
        if (!product) {
            throw new Error("Product not found");
        }
        const business = await this.businessRepository.findById(product.companyId);
        if (!business || business.ownerId !== userId) {
            throw new Error("Unauthorized: You do not own this business");
        }
        await this.inventoryRepository.delete(id);
    }
}
