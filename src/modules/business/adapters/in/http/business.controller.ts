import { Elysia, t } from "elysia";
import { authPlugin } from "../../../../infrastructure/auth/auth-plugin";
import { ListMyBusinessesUseCase } from "../../../application/use-cases/list-my-businesses.use-case";
import { CreateBusinessUseCase } from "../../../application/use-cases/create-business.use-case";
import { UpdateBusinessConfigUseCase } from "../../../application/use-cases/update-business-config.use-case";
import { createBusinessDTO, updateBusinessConfigDTO } from "../dtos/business.dto";

export const businessController = new Elysia({ prefix: "/api/business" })
  .use(authPlugin)
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
  });
