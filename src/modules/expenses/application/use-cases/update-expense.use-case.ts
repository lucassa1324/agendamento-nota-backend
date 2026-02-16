import { IExpenseRepository, CreateExpenseInput, FixedExpense } from "../../domain/ports/expense.repository";

export class UpdateExpenseUseCase {
  constructor(private expenseRepository: IExpenseRepository) { }

  async execute(id: string, businessId: string, data: Partial<CreateExpenseInput>): Promise<FixedExpense> {
    const existing = await this.expenseRepository.findById(id);

    if (!existing) {
      throw new Error("Expense not found");
    }

    if (existing.companyId !== businessId) {
      throw new Error("Unauthorized");
    }

    const updated = await this.expenseRepository.update(id, data);

    // Lógica de recorrência para despesas fixas
    // Se marcou como pago e é FIXO, cria o próximo mês se não existir
    if (existing.type === "FIXO" && data.isPaid === true && !existing.isPaid) {
      await this.handleRecurringExpense(existing);
    }

    return updated;
  }

  private async handleRecurringExpense(expense: FixedExpense) {
    const nextDueDate = new Date(expense.dueDate);
    nextDueDate.setMonth(nextDueDate.getMonth() + 1);

    // Verifica duplicidade no mês seguinte
    const all = await this.expenseRepository.findAllByCompanyId(expense.companyId);

    const exists = all.some(e =>
      e.description === expense.description &&
      e.dueDate.getMonth() === nextDueDate.getMonth() &&
      e.dueDate.getFullYear() === nextDueDate.getFullYear()
    );

    if (!exists) {
      await this.expenseRepository.create({
        companyId: expense.companyId,
        description: expense.description,
        value: expense.value,
        category: expense.category,
        dueDate: nextDueDate,
        type: "FIXO",
        totalInstallments: 1,
        currentInstallment: 1,
        isPaid: false,
        parentId: null
      });
    }
  }
}
