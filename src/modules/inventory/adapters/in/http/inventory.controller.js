import { Elysia, t } from "elysia";
import { authPlugin } from "../../../../infrastructure/auth/auth-plugin";
import { repositoriesPlugin } from "../../../../infrastructure/di/repositories.plugin";
import { CreateProductUseCase } from "../../../application/use-cases/create-product.use-case";
import { ListProductsUseCase } from "../../../application/use-cases/list-products.use-case";
import { UpdateProductUseCase } from "../../../application/use-cases/update-product.use-case";
import { DeleteProductUseCase } from "../../../application/use-cases/delete-product.use-case";
import { CreateInventoryTransactionUseCase } from "../../../application/use-cases/create-inventory-transaction.use-case";
import { CreateProductDTO, UpdateProductDTO, CreateTransactionDTO } from "../dtos/inventory.dto";
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
        return await createUseCase.execute(body, user.id);
    }
    catch (error) {
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
        return await listUseCase.execute(companyId, user.id);
    }
    catch (error) {
        console.error("[INVENTORY_CONTROLLER_GET_ERROR]:", error);
        if (error.message.includes("Unauthorized")) {
            set.status = 403;
        }
        else {
            set.status = 500;
        }
        return { error: error.message };
    }
})
    .patch("/:id", async ({ params: { id }, body, inventoryRepository, businessRepository, user, set }) => {
    try {
        console.log(`[INVENTORY_CONTROLLER] Atualizando produto ${id}:`, body);
        // @ts-ignore
        console.log(`[INVENTORY_CONTROLLER] isShared recebido:`, body.isShared, typeof body.isShared);
        const updateUseCase = new UpdateProductUseCase(inventoryRepository, businessRepository);
        return await updateUseCase.execute(id, body, user.id);
    }
    catch (error) {
        console.error("[INVENTORY_CONTROLLER_PATCH_ERROR]:", error);
        set.status = error.message.includes("Unauthorized") ? 403 : (error.message.includes("not found") ? 404 : 500);
        return { error: error.message };
    }
}, {
    body: UpdateProductDTO
})
    .post("/:id/subtract", async ({ params: { id }, body, inventoryRepository, businessRepository, userRepository, pushSubscriptionRepository, user, set }) => {
    try {
        console.log(`[INVENTORY_CONTROLLER] Subtraindo estoque para o produto ${id}:`, body);
        const product = await inventoryRepository.findById(id);
        if (!product) {
            set.status = 404;
            return { error: "Product not found" };
        }
        const subtractQty = parseFloat(body.quantity.toString());
        if (isNaN(subtractQty) || subtractQty <= 0) {
            set.status = 400;
            return { error: "Invalid quantity" };
        }
        const useCase = new CreateInventoryTransactionUseCase(inventoryRepository, businessRepository, userRepository, pushSubscriptionRepository);
        const result = await useCase.execute({
            productId: id,
            type: "EXIT",
            quantity: subtractQty,
            reason: "Baixa via Sistema (Subtract API)",
            companyId: product.companyId
        }, user.id);
        return result.product;
    }
    catch (error) {
        console.error("[INVENTORY_CONTROLLER_SUBTRACT_ERROR]:", error);
        if (error.message.includes("not found")) {
            set.status = 404;
        }
        else if (error.message.includes("insuficiente") || error.message.includes("inválido")) {
            set.status = 400;
        }
        else {
            set.status = 500;
        }
        return { error: error.message };
    }
}, {
    body: t.Object({
        quantity: t.Union([t.Number(), t.String()])
    })
})
    .post("/transactions", async ({ body, inventoryRepository, businessRepository, userRepository, pushSubscriptionRepository, user, set }) => {
    try {
        console.log(`[INVENTORY_CONTROLLER] Nova transação de estoque recebida:`, body);
        const useCase = new CreateInventoryTransactionUseCase(inventoryRepository, businessRepository, userRepository, pushSubscriptionRepository);
        const result = await useCase.execute({
            productId: body.productId,
            type: body.type,
            quantity: Number(body.quantity),
            reason: body.reason,
            companyId: body.companyId
        }, user.id);
        return result;
    }
    catch (error) {
        console.error("[INVENTORY_CONTROLLER_TRANSACTION_ERROR]:", error);
        if (error.message.includes("not found")) {
            set.status = 404;
        }
        else if (error.message.includes("obrigatório") || error.message.includes("inválido") || error.message.includes("insuficiente")) {
            set.status = 400;
        }
        else {
            set.status = 500;
        }
        return { error: error.message };
    }
}, {
    body: CreateTransactionDTO
})
    .get("/:id/logs", async ({ params: { id }, inventoryRepository, set }) => {
    try {
        const logs = await inventoryRepository.getLogsByProduct(id);
        return logs;
    }
    catch (error) {
        console.error("[INVENTORY_CONTROLLER_GET_LOGS_ERROR]:", error);
        set.status = 500;
        return { error: error.message };
    }
})
    .delete("/:id", async ({ params: { id }, inventoryRepository, businessRepository, user, set }) => {
    try {
        console.log(`[INVENTORY_CONTROLLER] Excluindo produto ${id}`);
        const deleteUseCase = new DeleteProductUseCase(inventoryRepository, businessRepository);
        await deleteUseCase.execute(id, user.id);
        set.status = 204;
        return;
    }
    catch (error) {
        console.error("[INVENTORY_DELETE_ERROR]:", error);
        set.status = error.message.includes("Unauthorized") ? 403 : (error.message.includes("not found") ? 404 : 500);
        return { error: error.message };
    }
});
