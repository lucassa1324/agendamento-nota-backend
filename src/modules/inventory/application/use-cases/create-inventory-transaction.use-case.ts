
import { InventoryRepository } from "../../domain/ports/inventory.repository";
import { IBusinessRepository } from "../../../business/domain/ports/business.repository";
import { UserRepository } from "../../../user/adapters/out/user.repository";
import { IPushSubscriptionRepository } from "../../../notifications/domain/ports/push-subscription.repository";
import { NotificationService } from "../../../notifications/application/notification.service";

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
    private businessRepository: IBusinessRepository,
    private userRepository: UserRepository,
    private pushSubscriptionRepository: IPushSubscriptionRepository
  ) { }

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
    const minQty = Number(product.minQuantity);
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

    // 7. Notificação de Estoque Baixo
    if (input.type === "EXIT" && newQty <= minQty) {
      try {
        // Obter dono da empresa
        const business = await this.businessRepository.findById(input.companyId);
        if (business) {
          const owner = await this.userRepository.find(business.ownerId);
          if (owner && owner.notifyInventoryAlerts) {
            const notificationService = new NotificationService(this.pushSubscriptionRepository);

            // Lógica de Conversão para Exibição
            let displayQty = Math.round(newQty);
            let displayUnit = product.unit;

            if (product.conversionFactor && product.secondaryUnit) {
              const factor = Number(product.conversionFactor);
              if (!isNaN(factor) && factor > 0) {
                displayQty = Math.round(newQty * factor);
                displayUnit = product.secondaryUnit;
              }
            }

            await notificationService.sendToUser(
              business.ownerId,
              "📦 Estoque Baixo!",
              `O produto ${product.name} atingiu o nível crítico (${displayQty} ${displayUnit}).`
            );
          }
        }
      } catch (err) {
        console.error("[INVENTORY_ALERT] Error sending notification:", err);
      }
    }

    return {
      product: updatedProduct,
      log
    };
  }
}
