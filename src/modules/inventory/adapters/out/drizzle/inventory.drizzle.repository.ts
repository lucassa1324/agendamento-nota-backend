import { db } from "../../../../infrastructure/drizzle/database";
import { inventory, inventoryLogs } from "../../../../../db/schema";
import { eq, desc } from "drizzle-orm";
import { InventoryRepository, Product, InventoryLog } from "../../../domain/ports/inventory.repository";

export class DrizzleInventoryRepository implements InventoryRepository {
  async create(data: Omit<Product, "id" | "createdAt" | "updatedAt">): Promise<Product> {
    try {
      const [result] = await db
        .insert(inventory)
        .values({
          id: crypto.randomUUID(),
          companyId: data.companyId,
          name: data.name,
          initialQuantity: data.initialQuantity.toString(),
          currentQuantity: data.currentQuantity.toString(),
          minQuantity: data.minQuantity.toString(),
          unitPrice: data.unitPrice.toString(),
          unit: data.unit || 'un',
          secondaryUnit: data.secondaryUnit || null,
          conversionFactor: data.conversionFactor?.toString() || null,
        })
        .returning();

      return result as Product;
    } catch (error: any) {
      console.error("[DRIZZLE_INVENTORY_REPOSITORY_CREATE_ERROR]:", error);
      throw error;
    }
  }

  async findById(id: string): Promise<Product | null> {
    try {
      const [result] = await db
        .select({
          id: inventory.id,
          companyId: inventory.companyId,
          name: inventory.name,
          initialQuantity: inventory.initialQuantity,
          currentQuantity: inventory.currentQuantity,
          minQuantity: inventory.minQuantity,
          unitPrice: inventory.unitPrice,
          unit: inventory.unit,
          secondaryUnit: inventory.secondaryUnit,
          conversionFactor: inventory.conversionFactor,
          createdAt: inventory.createdAt,
          updatedAt: inventory.updatedAt,
        })
        .from(inventory)
        .where(eq(inventory.id, id))
        .limit(1);

      return (result as Product) || null;
    } catch (error: any) {
      console.error("[DRIZZLE_INVENTORY_REPOSITORY_FINDBYID_ERROR]:", error);
      throw error;
    }
  }

  async findByCompanyId(companyId: string): Promise<Product[]> {
    try {
      const results = await db
        .select({
          id: inventory.id,
          companyId: inventory.companyId,
          name: inventory.name,
          initialQuantity: inventory.initialQuantity,
          currentQuantity: inventory.currentQuantity,
          minQuantity: inventory.minQuantity,
          unitPrice: inventory.unitPrice,
          unit: inventory.unit,
          secondaryUnit: inventory.secondaryUnit,
          conversionFactor: inventory.conversionFactor,
          createdAt: inventory.createdAt,
          updatedAt: inventory.updatedAt,
        })
        .from(inventory)
        .where(eq(inventory.companyId, companyId));

      return (results as Product[]) || [];
    } catch (error: any) {
      console.error("[DRIZZLE_INVENTORY_REPOSITORY_FINDBYCOMPANYID_ERROR]:", error);
      throw error;
    }
  }

  async update(id: string, data: Partial<Omit<Product, "id" | "companyId" | "createdAt" | "updatedAt">>): Promise<Product> {
    try {
      console.log(`[DRIZZLE_INVENTORY_REPO] Iniciando update para ID: ${id}`);
      console.log(`[DRIZZLE_INVENTORY_REPO] Valores para update:`, JSON.stringify(data, null, 2));

      const updateData: any = {
        updatedAt: new Date(),
      };

      // Mapeamento explícito para garantir que campos opcionais ou strings sejam tratados corretamente
      if (data.name !== undefined) updateData.name = data.name;
      if (data.unit !== undefined) updateData.unit = data.unit;

      if (data.initialQuantity !== undefined && data.initialQuantity !== null) {
        updateData.initialQuantity = data.initialQuantity.toString();
      }
      if (data.currentQuantity !== undefined && data.currentQuantity !== null) {
        updateData.currentQuantity = data.currentQuantity.toString();
      }
      if (data.minQuantity !== undefined && data.minQuantity !== null) {
        updateData.minQuantity = data.minQuantity.toString();
      }
      if (data.unitPrice !== undefined && data.unitPrice !== null) {
        updateData.unitPrice = data.unitPrice.toString();
      }
      if (data.conversionFactor !== undefined) {
        updateData.conversionFactor = data.conversionFactor?.toString() || null;
      }
      if (data.secondaryUnit !== undefined) {
        updateData.secondaryUnit = data.secondaryUnit || null;
      }

      console.log(`[DRIZZLE_INVENTORY_REPO] Objeto final enviado ao Drizzle .set():`, JSON.stringify(updateData, null, 2));

      const [result] = await db
        .update(inventory)
        .set(updateData)
        .where(eq(inventory.id, id))
        .returning({
          id: inventory.id,
          companyId: inventory.companyId,
          name: inventory.name,
          initialQuantity: inventory.initialQuantity,
          currentQuantity: inventory.currentQuantity,
          minQuantity: inventory.minQuantity,
          unitPrice: inventory.unitPrice,
          unit: inventory.unit,
          secondaryUnit: inventory.secondaryUnit,
          conversionFactor: inventory.conversionFactor,
          createdAt: inventory.createdAt,
          updatedAt: inventory.updatedAt,
        });

      if (!result) {
        console.error(`[DRIZZLE_INVENTORY_REPO] Produto com ID ${id} não encontrado para update.`);
        throw new Error("Product not found");
      }

      console.log(`[DRIZZLE_INVENTORY_REPO] Update realizado com sucesso. Resultado:`, JSON.stringify(result, null, 2));
      return result as Product;
    } catch (error: any) {
      console.error("[DRIZZLE_INVENTORY_REPOSITORY_UPDATE_ERROR]:", error);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    await db.delete(inventory).where(eq(inventory.id, id));
  }

  // Transaction Logs Implementation
  async createLog(log: Omit<InventoryLog, "id" | "createdAt">): Promise<InventoryLog> {
    try {
      const [result] = await db
        .insert(inventoryLogs)
        .values({
          id: crypto.randomUUID(),
          inventoryId: log.inventoryId,
          type: log.type,
          quantity: log.quantity.toString(),
          reason: log.reason,
          companyId: log.companyId,
        })
        .returning();

      return result as InventoryLog;
    } catch (error: any) {
      console.error("[DRIZZLE_INVENTORY_REPOSITORY_CREATELOG_ERROR]:", error);
      throw error;
    }
  }

  async getLogsByProduct(productId: string): Promise<InventoryLog[]> {
    try {
      const results = await db
        .select()
        .from(inventoryLogs)
        .where(eq(inventoryLogs.inventoryId, productId))
        .orderBy(desc(inventoryLogs.createdAt));

      return results as InventoryLog[];
    } catch (error: any) {
      console.error("[DRIZZLE_INVENTORY_REPOSITORY_GETLOGS_ERROR]:", error);
      throw error;
    }
  }

  async getLogsByCompany(companyId: string): Promise<InventoryLog[]> {
    try {
      const results = await db
        .select()
        .from(inventoryLogs)
        .where(eq(inventoryLogs.companyId, companyId))
        .orderBy(desc(inventoryLogs.createdAt));

      return results as InventoryLog[];
    } catch (error: any) {
      console.error("[DRIZZLE_INVENTORY_REPOSITORY_GETLOGS_BY_COMPANY_ERROR]:", error);
      throw error;
    }
  }
}
