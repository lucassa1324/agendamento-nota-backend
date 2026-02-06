import { InventoryRepository, Product } from "../../domain/ports/inventory.repository";
import { IBusinessRepository } from "../../../business/domain/ports/business.repository";

export class UpdateProductUseCase {
  constructor(
    private inventoryRepository: InventoryRepository,
    private businessRepository: IBusinessRepository
  ) { }

  async execute(
    id: string,
    data: Partial<Omit<Product, "id" | "companyId" | "createdAt" | "updatedAt">>,
    userId: string
  ): Promise<Product> {
    const product = await this.inventoryRepository.findById(id);

    if (!product) {
      throw new Error("Product not found");
    }

    const business = await this.businessRepository.findById(product.companyId);

    if (!business || business.ownerId !== userId) {
      throw new Error("Unauthorized: You do not own this business");
    }

    const updateData = { ...data };

    // Se a quantidade inicial for alterada, precisamos decidir se isso afeta o saldo atual.
    // Regra: Se o usuário estiver alterando o initialQuantity, vamos assumir que ele está corrigindo
    // o estoque base. O currentQuantity só deve mudar se for enviado explicitamente no payload.
    // No entanto, para evitar inconsistências, se o novo initialQuantity for menor que o currentQuantity atual,
    // podemos opcionalmente ajustar, mas por enquanto manteremos independentes conforme solicitado.

    return await this.inventoryRepository.update(id, updateData);
  }
}
