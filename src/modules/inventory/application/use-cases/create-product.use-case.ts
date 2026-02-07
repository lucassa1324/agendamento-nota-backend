import { InventoryRepository, Product } from "../../domain/ports/inventory.repository";
import { IBusinessRepository } from "../../../business/domain/ports/business.repository";

export class CreateProductUseCase {
  constructor(
    private inventoryRepository: InventoryRepository,
    private businessRepository: IBusinessRepository
  ) { }

  async execute(data: any, userId: string): Promise<Product> {
    const business = await this.businessRepository.findById(data.companyId);

    if (!business || business.ownerId !== userId) {
      throw new Error("Unauthorized: You do not own this business");
    }

    // Normalizar números para string (exigido pelo schema do Drizzle que usa decimal/numeric)
    const productData = {
      ...data,
      initialQuantity: String(data.initialQuantity),
      currentQuantity: String(data.currentQuantity ?? data.initialQuantity),
      minQuantity: String(data.minQuantity),
      unitPrice: String(data.unitPrice),
      unit: data.unit ?? 'un',
      conversionFactor: data.conversionFactor ? String(data.conversionFactor) : null
    };

    return await this.inventoryRepository.create(productData);
  }
}
