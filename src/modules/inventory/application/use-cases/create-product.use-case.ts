import { InventoryRepository, Product } from "../../domain/ports/inventory.repository";
import { IBusinessRepository } from "../../../business/domain/ports/business.repository";

export class CreateProductUseCase {
  constructor(
    private inventoryRepository: InventoryRepository,
    private businessRepository: IBusinessRepository
  ) { }

  async execute(data: Omit<Product, "id" | "createdAt" | "updatedAt">, userId: string): Promise<Product> {
    const business = await this.businessRepository.findById(data.companyId);

    if (!business || business.ownerId !== userId) {
      throw new Error("Unauthorized: You do not own this business");
    }

    // Se currentQuantity não for enviado, assume que é igual ao initialQuantity
    const productData = {
      ...data,
      currentQuantity: data.currentQuantity ?? data.initialQuantity,
      unit: data.unit ?? 'un' // Default para unidade se não enviado
    };

    return await this.inventoryRepository.create(productData);
  }
}
