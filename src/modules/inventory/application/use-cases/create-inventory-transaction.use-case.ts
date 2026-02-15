
import { InventoryRepository } from "../../domain/ports/inventory.repository";
import { IBusinessRepository } from "../../../business/domain/ports/business.repository";

export interface CreateInventoryTransactionInput {
  productId: string;
  type: "ENTRY" | "EXIT";
  quantity: number;
  reason: string;
  companyId: string;
}

export class CreateInventoryTransactionUseCase {
  constructor(
    private inventoryRepository: InventoryRepository,
    private businessRepository: IBusinessRepository
  ) {}

  async execute(input: CreateInventoryTransactionInput, userId: string) {
    console.log(`[CREATE_TRANSACTION_USECASE] Iniciando transação para produto ${input.productId}`);

    // 1. Validação de ID da Empresa
    if (!input.companyId || input.companyId === "N/A" || input.companyId.trim() === "") {
      throw new Error("ID da empresa é obrigatório e deve ser válido.");
    }

    // 2. Validação de Produto
    if (!input.productId || input.productId.trim() === "") {
        throw new Error("ID do produto é obrigatório.");
    }

    const product = await this.inventoryRepository.findById(input.productId);
    if (!product) {
      throw new Error("Product not found");
    }

    // Validação de Pertencimento (Segurança)
    if (product.companyId !== input.companyId) {
        throw new Error("Produto não pertence à empresa informada.");
    }

    // 3. Validação de Quantidade
    const quantity = Number(input.quantity);
    if (isNaN(quantity) || quantity <= 0) {
      throw new Error("Quantidade deve ser um número positivo válido.");
    }

    // 4. Lógica de Atualização de Saldo
    const currentQty = Number(product.currentQuantity);
    let newQty = currentQty;

    if (input.type === "ENTRY") {
      newQty = currentQty + quantity;
    } else if (input.type === "EXIT") {
      if (currentQty < quantity) {
        throw new Error("Saldo insuficiente para realizar a saída.");
      }
      newQty = currentQty - quantity;
    } else {
        throw new Error("Tipo de transação inválido. Use ENTRY ou EXIT.");
    }

    // 5. Persistência da Transação (Log)
    const log = await this.inventoryRepository.createLog({
      inventoryId: input.productId,
      type: input.type,
      quantity: quantity.toString(),
      reason: input.reason || "Movimentação manual",
      companyId: input.companyId
    });

    // 6. Atualização do Produto
    const updatedProduct = await this.inventoryRepository.update(input.productId, {
      currentQuantity: newQty.toString()
    });

    console.log(`[CREATE_TRANSACTION_USECASE] Sucesso: ${input.type} de ${quantity} para ${product.name}. Novo saldo: ${newQty}`);

    return {
      product: updatedProduct,
      log
    };
  }
}
