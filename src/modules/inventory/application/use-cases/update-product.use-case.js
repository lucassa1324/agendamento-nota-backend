export class UpdateProductUseCase {
    constructor(inventoryRepository, businessRepository) {
        this.inventoryRepository = inventoryRepository;
        this.businessRepository = businessRepository;
    }
    async execute(id, data, userId) {
        const product = await this.inventoryRepository.findById(id);
        if (!product) {
            throw new Error("Product not found");
        }
        const business = await this.businessRepository.findById(product.companyId);
        if (!business || business.ownerId !== userId) {
            throw new Error("Unauthorized: You do not own this business");
        }
        // Normalizar números para string (exigido pelo schema do Drizzle que usa decimal/numeric)
        const updateData = { ...data };
        if (data.initialQuantity !== undefined)
            updateData.initialQuantity = String(data.initialQuantity);
        if (data.currentQuantity !== undefined)
            updateData.currentQuantity = String(data.currentQuantity);
        if (data.minQuantity !== undefined)
            updateData.minQuantity = String(data.minQuantity);
        if (data.unitPrice !== undefined)
            updateData.unitPrice = String(data.unitPrice);
        if (data.conversionFactor !== undefined)
            updateData.conversionFactor = data.conversionFactor ? String(data.conversionFactor) : null;
        return await this.inventoryRepository.update(id, updateData);
    }
}
