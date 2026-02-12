import { Elysia, t } from "elysia";
import { authPlugin } from "../../../../infrastructure/auth/auth-plugin";
import { repositoriesPlugin } from "../../../../infrastructure/di/repositories.plugin";
import { CreateProductUseCase } from "../../../application/use-cases/create-product.use-case";
import { ListProductsUseCase } from "../../../application/use-cases/list-products.use-case";
import { UpdateProductUseCase } from "../../../application/use-cases/update-product.use-case";
import { DeleteProductUseCase } from "../../../application/use-cases/delete-product.use-case";
import { CreateProductDTO, UpdateProductDTO } from "../dtos/inventory.dto";

export const inventoryController = new Elysia({ prefix: "/inventory" })
  .use(repositoriesPlugin)
  .use(authPlugin)
  .onBeforeHandle(({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }
  })
  .post("/", async ({ body, inventoryRepository, businessRepository, user, set }) => {
    try {
      console.log('Dados recebidos no POST /api/inventory:', body);
      console.log(`[INVENTORY_CONTROLLER] Criando produto para empresa: ${body.companyId}`);
      const createUseCase = new CreateProductUseCase(inventoryRepository, businessRepository);
      return await createUseCase.execute(body, user!.id);
    } catch (error: any) {
      console.error("[INVENTORY_CONTROLLER_POST_ERROR]:", error);
      set.status = error.message.includes("Unauthorized") ? 403 : 500;
      return { error: error.message };
    }
  }, {
    body: CreateProductDTO
  })
  .get("/company/:companyId", async ({ params: { companyId }, inventoryRepository, businessRepository, user, set }) => {
    try {
      console.log(`[INVENTORY_CONTROLLER] Listando produtos para empresa: ${companyId}`);
      if (!companyId || companyId.trim() === "") {
        set.status = 400;
        return { error: "ID da empresa é obrigatório" };
      }

      // Validação básica de UUID v4
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(companyId)) {
        set.status = 400;
        return { error: "Formato de ID da empresa inválido" };
      }

      const listUseCase = new ListProductsUseCase(inventoryRepository, businessRepository);
      return await listUseCase.execute(companyId, user!.id);
    } catch (error: any) {
      console.error("[INVENTORY_CONTROLLER_GET_ERROR]:", error);
      if (error.message.includes("Unauthorized")) {
        set.status = 403;
      } else {
        set.status = 500;
      }
      return { error: error.message };
    }
  })
  .patch("/:id", async ({ params: { id }, body, inventoryRepository, businessRepository, user, set }) => {
    try {
      console.log(`[INVENTORY_CONTROLLER] Atualizando produto ${id}:`, body);
      const updateUseCase = new UpdateProductUseCase(inventoryRepository, businessRepository);
      return await updateUseCase.execute(id, body, user!.id);
    } catch (error: any) {
      console.error("[INVENTORY_CONTROLLER_PATCH_ERROR]:", error);
      set.status = error.message.includes("Unauthorized") ? 403 : (error.message.includes("not found") ? 404 : 500);
      return { error: error.message };
    }
  }, {
    body: UpdateProductDTO
  })
  .post("/:id/subtract", async ({ params: { id }, body, inventoryRepository, user, set }) => {
    try {
      console.log(`[INVENTORY_CONTROLLER] Subtraindo estoque para o produto ${id}:`, body);

      const product = await inventoryRepository.findById(id);
      if (!product) {
        set.status = 404;
        return { error: "Product not found" };
      }

      const currentQty = parseFloat(product.currentQuantity);
      const subtractQty = parseFloat(body.quantity.toString());

      if (isNaN(subtractQty)) {
        set.status = 400;
        return { error: "Invalid quantity" };
      }

      const newQty = Math.max(0, currentQty - subtractQty);

      const updated = await inventoryRepository.update(id, {
        currentQuantity: newQty.toString()
      });

      console.log(`[INVENTORY_CONTROLLER] Estoque atualizado: ${currentQty} -> ${newQty}`);
      return updated;
    } catch (error: any) {
      console.error("[INVENTORY_CONTROLLER_SUBTRACT_ERROR]:", error);
      set.status = 500;
      return { error: error.message };
    }
  }, {
    body: t.Object({
      quantity: t.Union([t.Number(), t.String()])
    })
  })
  .delete("/:id", async ({ params: { id }, inventoryRepository, businessRepository, user, set }) => {
    try {
      console.log(`[INVENTORY_CONTROLLER] Excluindo produto ${id}`);
      const deleteUseCase = new DeleteProductUseCase(inventoryRepository, businessRepository);
      await deleteUseCase.execute(id, user!.id);
      set.status = 204;
      return;
    } catch (error: any) {
      console.error("[INVENTORY_DELETE_ERROR]:", error);
      set.status = error.message.includes("Unauthorized") ? 403 : (error.message.includes("not found") ? 404 : 500);
      return { error: error.message };
    }
  });
