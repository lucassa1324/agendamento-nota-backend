import { IExpenseRepository, CreateExpenseInput, FixedExpense } from "../../domain/ports/expense.repository";

export class CreateExpenseUseCase {
  constructor(private expenseRepository: IExpenseRepository) {}

  async execute(data: CreateExpenseInput): Promise<FixedExpense> {
    const { type, totalInstallments = 1, dueDate, value, description, ...rest } = data;

    // Se não for parcelado ou tiver apenas 1 parcela, cria normalmente
    if (type !== "PARCELADO" || totalInstallments <= 1) {
      return this.expenseRepository.create({
        ...data,
        type: type || "FIXO",
        totalInstallments: 1,
        currentInstallment: 1,
      });
    }

    // Lógica para Parcelamento
    const installments: FixedExpense[] = [];
    const baseDate = new Date(dueDate);
    
    // Calcula o valor de cada parcela se necessário. 
    // O prompt não especifica se o valor recebido é o TOTAL ou da PARCELA.
    // Geralmente em inputs de despesa, o usuário digita o valor da parcela.
    // Vou assumir que 'value' é o valor da parcela mensal.
    
    // Cria a primeira parcela (que será o parent das outras)
    const firstInstallment = await this.expenseRepository.create({
      ...rest,
      description: `${description} (1/${totalInstallments})`,
      value,
      dueDate: baseDate,
      type: "PARCELADO",
      totalInstallments,
      currentInstallment: 1,
      parentId: null, // É a pai
    });

    installments.push(firstInstallment);

    // Cria as demais parcelas
    for (let i = 2; i <= totalInstallments; i++) {
      const nextDate = new Date(baseDate);
      nextDate.setMonth(baseDate.getMonth() + (i - 1));

      await this.expenseRepository.create({
        ...rest,
        description: `${description} (${i}/${totalInstallments})`,
        value,
        dueDate: nextDate,
        type: "PARCELADO",
        totalInstallments,
        currentInstallment: i,
        parentId: firstInstallment.id,
      });
    }

    return firstInstallment;
  }
}
