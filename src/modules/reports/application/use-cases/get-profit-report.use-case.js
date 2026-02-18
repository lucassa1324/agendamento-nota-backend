export class GetProfitReportUseCase {
    constructor(expenseRepository, appointmentRepository) {
        this.expenseRepository = expenseRepository;
        this.appointmentRepository = appointmentRepository;
    }
    async execute(input) {
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
