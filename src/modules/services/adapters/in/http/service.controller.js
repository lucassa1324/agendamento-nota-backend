import { Elysia } from "elysia";
import { authPlugin } from "../../../../infrastructure/auth/auth-plugin";
import { repositoriesPlugin } from "../../../../infrastructure/di/repositories.plugin";
import { CreateServiceUseCase } from "../../../application/use-cases/create-service.use-case";
import { createServiceDTO } from "../dtos/service.dto";
export const serviceController = new Elysia({ prefix: "/services" })
    .use(repositoriesPlugin)
    .use(authPlugin)
    // --- ROTAS PÚBLICAS ---
    .get("/company/:companyId", async ({ params: { companyId }, serviceRepository, set }) => {
    try {
        console.log(`>>> [BACK_PUBLIC_ACCESS] Serviços liberados para a empresa: ${companyId}`);
        // Forçar o navegador a não usar cache para garantir que os serviços novos apareçam
        set.headers["Cache-Control"] = "no-store, max-age=0, must-revalidate";
        set.headers["Pragma"] = "no-cache";
        set.headers["Expires"] = "0";
        const services = await serviceRepository.findAllByCompanyId(companyId);
        return services || [];
    }
    catch (error) {
        console.error("\n[SERVICE_CONTROLLER_GET_ERROR]:", error);
        set.status = 500;
        return {
            error: error.message || "Internal Server Error",
            details: error.detail || error.cause || null
        };
    }
})
    // --- ROTAS PRIVADAS (EXIGEM AUTH) ---
    .group("", (app) => app.onBeforeHandle(({ user, set }) => {
    if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
    }
})
    .post("/", async ({ body, serviceRepository, user, set }) => {
    try {
        console.log(`\n>>> [BACK_RECEIVED] POST /api/services:`, JSON.stringify(body, null, 2));
        const businessId = user.businessId;
        if (!businessId) {
            set.status = 401;
            return { error: "Usuário não vinculado a uma empresa" };
        }
        // Força o companyId do usuário logado por segurança
        const normalizedBody = {
            ...body,
            companyId: businessId,
            price: body.price.toString(),
            duration: body.duration.toString(),
            showOnHome: body.show_on_home !== undefined ? body.show_on_home : body.showOnHome,
            advancedRules: body.advanced_rules || body.advancedRules
        };
        const createServiceUseCase = new CreateServiceUseCase(serviceRepository);
        const result = await createServiceUseCase.execute(normalizedBody);
        console.log(`[SERVICE_CONTROLLER] Serviço processado com sucesso: ${result.id}`);
        return result;
    }
    catch (error) {
        console.error("\n[SERVICE_CONTROLLER_ERROR]:", error);
        set.status = 500;
        // Captura detalhes específicos de erro de conexão ou banco
        const errorMessage = error.message || "Internal Server Error";
        const errorDetail = error.detail || error.cause || null;
        return {
            error: errorMessage,
            details: errorDetail,
            code: error.code // Código de erro do Postgres (ex: 22P02 para invalid text representation)
        };
    }
}, {
    body: createServiceDTO
})
    .put("/:id", async ({ params: { id }, body, serviceRepository, user, set }) => {
    try {
        console.log(`\n>>> [BACK_RECEIVED] PUT /api/services/${id}:`, JSON.stringify(body, null, 2));
        const businessId = user.businessId;
        const existing = await serviceRepository.findById(id);
        if (!existing) {
            set.status = 404;
            return { error: "Service not found" };
        }
        if (existing.companyId !== businessId) {
            set.status = 403;
            return { error: "Não autorizado" };
        }
        // Normaliza os dados para garantir que price e duration sejam strings
        const normalizedBody = {
            ...body,
            showOnHome: body.show_on_home !== undefined ? body.show_on_home : body.showOnHome,
            advancedRules: body.advanced_rules || body.advancedRules
        };
        if (body.price !== undefined)
            normalizedBody.price = body.price.toString();
        if (body.duration !== undefined)
            normalizedBody.duration = body.duration.toString();
        console.log(`>>> [BACK_RECEIVED] Body normalizado para o repositório:`, JSON.stringify(normalizedBody, null, 2));
        const updated = await serviceRepository.update(id, normalizedBody);
        return updated;
    }
    catch (error) {
        console.error("\n[SERVICE_CONTROLLER_PUT_ERROR]:", error);
        set.status = 500;
        return {
            error: error.message || "Internal Server Error",
            details: error.detail || error.cause || null
        };
    }
}, {
    body: createServiceDTO
})
    .delete("/:id", async ({ params: { id }, serviceRepository, user, set }) => {
    try {
        console.log(`[SERVICE_CONTROLLER] Deletando serviço ${id}`);
        const businessId = user.businessId;
        const existing = await serviceRepository.findById(id);
        if (!existing) {
            set.status = 404;
            return { error: "Service not found" };
        }
        if (existing.companyId !== businessId) {
            set.status = 403;
            return { error: "Não autorizado" };
        }
        const success = await serviceRepository.delete(id);
        return { success: true };
    }
    catch (error) {
        console.error("\n[SERVICE_CONTROLLER_DELETE_ERROR]:", error);
        set.status = 500;
        return {
            error: error.message || "Internal Server Error"
        };
    }
})
    .get("/check-exists/:id", async ({ params: { id }, serviceRepository, set }) => {
    try {
        console.log(`[SERVICE_CONTROLLER] Verificando existência do serviço com ID: ${id}`);
        const exists = await serviceRepository.checkServiceExists(id);
        console.log(`[SERVICE_CONTROLLER] Serviço com ID ${id} existe: ${exists}`);
        return { id, exists };
    }
    catch (error) {
        console.error("\n[SERVICE_CONTROLLER_CHECK_EXISTS_ERROR]:", error);
        set.status = 500;
        return {
            error: error.message || "Internal Server Error",
            details: error.detail || error.cause || null
        };
    }
}));
