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
  .post("/", async ({ body, expenseRepository }) => {
    return await expenseRepository.create({
      ...body,
      dueDate: new Date(body.dueDate),
    });
  }, {
    body: CreateExpenseDto
  })
  .get("/", async ({ query, expenseRepository }) => {
    const { companyId } = query;
    if (!companyId) throw new Error("companyId is required");
    return await expenseRepository.findAllByCompanyId(companyId);
  }, {
    query: t.Object({
      companyId: t.String()
    })
  })
  .patch("/:id", async ({ params: { id }, body, expenseRepository }) => {
    const updateData: any = { ...body };
    if (body.dueDate) updateData.dueDate = new Date(body.dueDate);
    return await expenseRepository.update(id, updateData);
  }, {
    body: UpdateExpenseDto
  })
  .delete("/:id", async ({ params: { id }, expenseRepository }) => {
    await expenseRepository.delete(id);
    return { success: true };
  });
