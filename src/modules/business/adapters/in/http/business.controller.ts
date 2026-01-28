import { Elysia, t } from "elysia";
import { authPlugin } from "../../../../infrastructure/auth/auth-plugin";
import { repositoriesPlugin } from "../../../../infrastructure/di/repositories.plugin";
import { ListMyBusinessesUseCase } from "../../../application/use-cases/list-my-businesses.use-case";
import { CreateBusinessUseCase } from "../../../application/use-cases/create-business.use-case";
import { UpdateBusinessConfigUseCase } from "../../../application/use-cases/update-business-config.use-case";
import { createBusinessDTO, updateBusinessConfigDTO } from "../dtos/business.dto";
import { updateOperatingHoursDTO, createAgendaBlockDTO } from "../dtos/business.settings.dto";
import { UpdateOperatingHoursUseCase } from "../../../application/use-cases/update-operating-hours.use-case";
import { GetOperatingHoursUseCase } from "../../../application/use-cases/get-operating-hours.use-case";
import { CreateAgendaBlockUseCase } from "../../../application/use-cases/create-agenda-block.use-case";

export const businessController = new Elysia({ prefix: "/api/business" })
  .use(repositoriesPlugin)
  .use(authPlugin)
  .onError(({ code, error, set }) => {
    const message = (error as any)?.message ?? String(error);
    const detail = (error as any)?.errors ?? (error as any)?.cause ?? null;
    console.error("BUSINESS_CONTROLLER_VALIDATION_ERROR", code, message, detail);
    if (code === "VALIDATION") {
      set.status = 422;
      return {
        error: "ValidationError",
        message,
        detail
      };
    }
  })
  .onBeforeHandle(({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }
  })
  .get("/my", async ({ user, businessRepository }) => {
    const listMyBusinessesUseCase = new ListMyBusinessesUseCase(businessRepository);
    return await listMyBusinessesUseCase.execute(user!.id);
  })
  .post("/", async ({ user, body, set, businessRepository }) => {
    try {
      const createBusinessUseCase = new CreateBusinessUseCase(businessRepository);
      return await createBusinessUseCase.execute(user!.id, body);
    } catch (error: any) {
      set.status = 400;
      return { error: error.message };
    }
  }, {
    body: createBusinessDTO
  })
  .patch("/:id/config", async ({ user, params: { id }, body, set, businessRepository }) => {
    try {
      const updateBusinessConfigUseCase = new UpdateBusinessConfigUseCase(businessRepository);
      return await updateBusinessConfigUseCase.execute(id, user!.id, body);
    } catch (error: any) {
      set.status = 400;
      return { error: error.message };
    }
  }, {
    body: updateBusinessConfigDTO,
    params: t.Object({
      id: t.String()
    })
  })
  .put("/settings/:companyId", async ({ user, params: { companyId }, body, businessRepository, set }) => {
    try {
      console.log("BUSINESS_SETTINGS_PUT", JSON.stringify(body));
      const interval = (body as any).interval ?? (body as any).timeInterval;
      if (!interval || !/^\d{2}:\d{2}$/.test(interval)) {
        set.status = 422;
        console.error("BUSINESS_SETTINGS_INTERVAL_INVALID", interval);
        return { error: "Invalid interval format", field: "interval", expected: "HH:mm" };
      }
      if (!Array.isArray(body?.weekly) || body.weekly.length !== 7) {
        set.status = 422;
        console.error("BUSINESS_SETTINGS_WEEKLY_LENGTH_INVALID", Array.isArray(body?.weekly) ? body.weekly.length : null);
        return { error: "Weekly must have 7 days", field: "weekly.length", expected: 7 };
      }
      const useCase = new UpdateOperatingHoursUseCase(businessRepository);
      const normalizedBody = { ...(body as any), interval };
      return await useCase.execute(companyId, user!.id, normalizedBody as any);
    } catch (error: any) {
      set.status = error.message?.includes("Unauthorized") ? 403 : 400;
      return { error: error.message };
    }
  }, {
    body: updateOperatingHoursDTO,
    params: t.Object({ companyId: t.String() })
  })
  .put("/settings/:companyId/", async ({ user, params: { companyId }, body, businessRepository, set }) => {
    try {
      console.log("BUSINESS_SETTINGS_PUT", JSON.stringify(body));
      const interval = (body as any).interval ?? (body as any).timeInterval;
      if (!interval || !/^\d{2}:\d{2}$/.test(interval)) {
        set.status = 422;
        console.error("BUSINESS_SETTINGS_INTERVAL_INVALID", interval);
        return { error: "Invalid interval format", field: "interval", expected: "HH:mm" };
      }
      if (!Array.isArray(body?.weekly) || body.weekly.length !== 7) {
        set.status = 422;
        console.error("BUSINESS_SETTINGS_WEEKLY_LENGTH_INVALID", Array.isArray(body?.weekly) ? body.weekly.length : null);
        return { error: "Weekly must have 7 days", field: "weekly.length", expected: 7 };
      }
      const useCase = new UpdateOperatingHoursUseCase(businessRepository);
      const normalizedBody = { ...(body as any), interval };
      return await useCase.execute(companyId, user!.id, normalizedBody as any);
    } catch (error: any) {
      set.status = error.message?.includes("Unauthorized") ? 403 : 400;
      return { error: error.message };
    }
  }, {
    body: updateOperatingHoursDTO,
    params: t.Object({ companyId: t.String() })
  })
  .get("/settings/:companyId", async ({ user, params: { companyId }, businessRepository, set }) => {
    try {
      const useCase = new GetOperatingHoursUseCase(businessRepository);
      return await useCase.execute(companyId, user!.id);
    } catch (error: any) {
      set.status = error.message?.includes("Unauthorized") ? 403 : 400;
      return { error: error.message };
    }
  }, {
    params: t.Object({ companyId: t.String() })
  })
  .get("/settings/:companyId/", async ({ user, params: { companyId }, businessRepository, set }) => {
    try {
      const useCase = new GetOperatingHoursUseCase(businessRepository);
      return await useCase.execute(companyId, user!.id);
    } catch (error: any) {
      set.status = error.message?.includes("Unauthorized") ? 403 : 400;
      return { error: error.message };
    }
  }, {
    params: t.Object({ companyId: t.String() })
  })
  .post("/settings/:companyId/blocks", async ({ user, params: { companyId }, body, businessRepository, set }) => {
    try {
      const useCase = new CreateAgendaBlockUseCase(businessRepository);
      return await useCase.execute(companyId, user!.id, body);
    } catch (error: any) {
      set.status = error.message?.includes("Unauthorized") ? 403 : 400;
      return { error: error.message };
    }
  }, {
    body: createAgendaBlockDTO,
    params: t.Object({ companyId: t.String() })
  })
  .post("/settings/:companyId/blocks/", async ({ user, params: { companyId }, body, businessRepository, set }) => {
    try {
      const useCase = new CreateAgendaBlockUseCase(businessRepository);
      return await useCase.execute(companyId, user!.id, body);
    } catch (error: any) {
      set.status = error.message?.includes("Unauthorized") ? 403 : 400;
      return { error: error.message };
    }
  }, {
    body: createAgendaBlockDTO,
    params: t.Object({ companyId: t.String() })
  });
