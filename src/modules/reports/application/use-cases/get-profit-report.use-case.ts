import { IExpenseRepository } from "../../../expenses/domain/ports/expense.repository";
import { IAppointmentRepository } from "../../../appointments/domain/ports/appointment.repository";

export interface GetProfitReportInput {
  companyId: string;
  startDate?: Date;
  endDate?: Date;
}

export interface ProfitReportOutput {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  margin: number;
}

export class GetProfitReportUseCase {
  constructor(
    private expenseRepository: IExpenseRepository,
    private appointmentRepository: IAppointmentRepository
  ) {}

  async execute(input: GetProfitReportInput): Promise<ProfitReportOutput> {
    const [totalRevenue, totalExpenses] = await Promise.all([
      this.appointmentRepository.sumRevenueByCompanyId(input.companyId, input.startDate, input.endDate),
      this.expenseRepository.sumTotalByCompanyId(input.companyId, input.startDate, input.endDate)
    ]);

    const netProfit = totalRevenue - totalExpenses;
    const margin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    return {
      totalRevenue,
      totalExpenses,
      netProfit,
      margin: parseFloat(margin.toFixed(2))
    };
  }
}
