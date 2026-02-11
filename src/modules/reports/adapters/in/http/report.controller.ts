import { Elysia, t } from "elysia";
import { authPlugin } from "../../../../infrastructure/auth/auth-plugin";
import { repositoriesPlugin } from "../../../../infrastructure/di/repositories.plugin";
import { GetProfitReportUseCase } from "../../../application/use-cases/get-profit-report.use-case";

export const reportController = new Elysia({ prefix: "/reports" })
  .use(authPlugin)
  .use(repositoriesPlugin)
  .onBeforeHandle(({ user, set, request }) => {
    console.log(`>>> [AUTH_CHECK] Tentativa de acesso a ${request.method} ${request.url}`);
    if (!user) {
      console.log(`>>> [AUTH_CHECK] Usuário NÃO autenticado (401)`);
      set.status = 401;
      return { error: "Unauthorized" };
    }
    console.log(`>>> [AUTH_CHECK] Usuário autenticado: ${user.id}`);
  })
  .get("/profit", async ({ query, expenseRepository, appointmentRepository }) => {
    const useCase = new GetProfitReportUseCase(expenseRepository, appointmentRepository);

    return await useCase.execute({
      companyId: query.companyId,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
    });
  }, {
    query: t.Object({
      companyId: t.String(),
      startDate: t.Optional(t.String()),
      endDate: t.Optional(t.String()),
    })
  });
