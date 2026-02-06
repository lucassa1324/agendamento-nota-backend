import { InventoryRepository, Product } from "../../domain/ports/inventory.repository";
import { IBusinessRepository } from "../../../business/domain/ports/business.repository";

export class ListProductsUseCase {
  constructor(
    private inventoryRepository: InventoryRepository,
    private businessRepository: IBusinessRepository
  ) { }

  async execute(companyId: string, userId: string): Promise<Product[]> {
    const business = await this.businessRepository.findById(companyId);

    if (!business || business.ownerId !== userId) {
      throw new Error("Unauthorized: You do not own this business");
    }

    const products = await this.inventoryRepository.findByCompanyId(companyId);
    return products || [];
  }
}
