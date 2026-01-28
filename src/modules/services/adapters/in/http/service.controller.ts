import { Elysia } from "elysia";
import { authPlugin } from "../../../../infrastructure/auth/auth-plugin";
import { repositoriesPlugin } from "../../../../infrastructure/di/repositories.plugin";
import { CreateServiceUseCase } from "../../../application/use-cases/create-service.use-case";
import { createServiceDTO } from "../dtos/service.dto";

export const serviceController = new Elysia({ prefix: "/api/services" })
  .use(repositoriesPlugin)
  .use(authPlugin)
  .onBeforeHandle(({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }
  })
  .post("/", async ({ body, serviceRepository, set }) => {
    try {
      console.log(`[SERVICE_CONTROLLER] Iniciando criação/atualização de serviço para empresa: ${body.companyId}`);
      console.log(`[SERVICE_CONTROLLER] Payload recebido:`, JSON.stringify(body, null, 2));

      // Normaliza os dados para garantir que price e duration sejam strings
      const normalizedBody = {
        ...body,
        price: body.price.toString(),
        duration: body.duration.toString()
      };

      const createServiceUseCase = new CreateServiceUseCase(serviceRepository);
      const result = await createServiceUseCase.execute(normalizedBody);

      console.log(`[SERVICE_CONTROLLER] Serviço processado com sucesso: ${result.id}`);
      return result;
    } catch (error: any) {
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
  .put("/:id", async ({ params: { id }, body, serviceRepository, set }) => {
    try {
      console.log(`[SERVICE_CONTROLLER] Atualizando serviço ${id}`);
      
      // Normaliza os dados para garantir que price e duration sejam strings
      const normalizedBody = {
        ...body,
        price: body.price.toString(),
        duration: body.duration.toString()
      };

      // O repositório DrizzleServiceRepository já possui um método update que faz o set parcial
      const updated = await serviceRepository.update(id, normalizedBody);
      
      if (!updated) {
        set.status = 404;
        return { error: "Service not found" };
      }

      return updated;
    } catch (error: any) {
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
  .delete("/:id", async ({ params: { id }, serviceRepository, set }) => {
    try {
      console.log(`[SERVICE_CONTROLLER] Deletando serviço ${id}`);
      const success = await serviceRepository.delete(id);
      
      if (!success) {
        set.status = 404;
        return { error: "Service not found" };
      }

      return { success: true };
    } catch (error: any) {
      console.error("\n[SERVICE_CONTROLLER_DELETE_ERROR]:", error);
      set.status = 500;
      return {
        error: error.message || "Internal Server Error"
      };
    }
  })
  .get("/company/:companyId", async ({ params: { companyId }, serviceRepository, set }) => {
    try {
      console.log(`[SERVICE_CONTROLLER] Listando serviços para empresa: ${companyId}`);
      const services = await serviceRepository.findAllByCompanyId(companyId);
      return services || [];
    } catch (error: any) {
      console.error("\n[SERVICE_CONTROLLER_GET_ERROR]:", error);
      set.status = 500;
      return {
        error: error.message || "Internal Server Error",
        details: error.detail || error.cause || null
      };
    }
  })
  .get("/check-exists/:id", async ({ params: { id }, serviceRepository, set }) => {
    try {
      console.log(`[SERVICE_CONTROLLER] Verificando existência do serviço com ID: ${id}`);
      const exists = await serviceRepository.checkServiceExists(id);
      console.log(`[SERVICE_CONTROLLER] Serviço com ID ${id} existe: ${exists}`);
      return { id, exists };
    } catch (error: any) {
      console.error("\n[SERVICE_CONTROLLER_CHECK_EXISTS_ERROR]:", error);
      set.status = 500;
      return {
        error: error.message || "Internal Server Error",
        details: error.detail || error.cause || null
      };
    }
  });
