import { Elysia, t } from "elysia";
import { authPlugin } from "../../../../infrastructure/auth/auth-plugin";
import { repositoriesPlugin } from "../../../../infrastructure/di/repositories.plugin";
import { CreateExpenseDto, UpdateExpenseDto } from "../dtos/expense.dto";

export const expenseController = new Elysia({ prefix: "/expenses" })
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
  .post("/", async ({ body, expenseRepository, user, set }) => {
    const businessId = user!.businessId;
    if (!businessId) {
      set.status = 401;
      return { error: "Usuário não vinculado a uma empresa" };
    }

    return await expenseRepository.create({
      ...body,
      companyId: businessId, // Força o companyId do usuário logado
      dueDate: new Date(body.dueDate),
    });
  }, {
    body: CreateExpenseDto
  })
  .get("/", async ({ query, expenseRepository, user, set }) => {
    const businessId = user!.businessId;
    const { companyId } = query;

    // Se companyId for passado, verifica se é o do usuário logado
    // Se não for passado, usa o do usuário logado
    const targetCompanyId = companyId || businessId;

    if (!targetCompanyId) {
      set.status = 400;
      return { error: "companyId is required" };
    }

    if (targetCompanyId !== businessId) {
      set.status = 403;
      return { error: "Não autorizado" };
    }

    return await expenseRepository.findAllByCompanyId(targetCompanyId);
  }, {
    query: t.Object({
      companyId: t.Optional(t.String())
    })
  })
  .patch("/:id", async ({ params: { id }, body, expenseRepository, user, set }) => {
    const businessId = user!.businessId;
    const existing = await expenseRepository.findById(id);

    if (!existing) {
      set.status = 404;
      return { error: "Expense not found" };
    }

    if (existing.companyId !== businessId) {
      set.status = 403;
      return { error: "Não autorizado" };
    }

    const updateData: any = { ...body };
    if (body.dueDate) updateData.dueDate = new Date(body.dueDate);
    return await expenseRepository.update(id, updateData);
  }, {
    body: UpdateExpenseDto
  })
  .delete("/:id", async ({ params: { id }, expenseRepository, user, set }) => {
    const businessId = user!.businessId;
    const existing = await expenseRepository.findById(id);

    if (!existing) {
      set.status = 404;
      return { error: "Expense not found" };
    }

    if (existing.companyId !== businessId) {
      set.status = 403;
      return { error: "Não autorizado" };
    }

    await expenseRepository.delete(id);
    return { success: true };
  });
