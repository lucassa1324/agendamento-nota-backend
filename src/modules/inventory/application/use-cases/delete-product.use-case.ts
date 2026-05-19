import { InventoryRepository } from "../../domain/ports/inventory.repository";
import { IBusinessRepository } from "../../../business/domain/ports/business.repository";

export class DeleteProductUseCase {
  constructor(
    private inventoryRepository: InventoryRepository,
    private businessRepository: IBusinessRepository
  ) { }

  async execute(id: string, userId: string): Promise<void> {
    const product = await this.inventoryRepository.findById(id);

    if (!product) {
      throw new Error("Produto não encontrado");
    }

    const business = await this.businessRepository.findById(product.companyId);

    if (!business || business.ownerId !== userId) {
      throw new Error("Não autorizado: você não é o proprietário desta empresa");
    }

    await this.inventoryRepository.delete(id);
  }
}
