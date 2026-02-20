export class ListAppointmentsUseCase {
    constructor(appointmentRepository, businessRepository) {
        this.appointmentRepository = appointmentRepository;
        this.businessRepository = businessRepository;
    }
    async execute(companyId, userId, startDate, endDate) {
        // Verifica se a empresa pertence ao usuário (Isolamento Admin)
        // Se userId não for fornecido, é uma busca pública (sanitizada pelo controller)
        if (userId) {
            const business = await this.businessRepository.findById(companyId);
            if (!business || business.ownerId !== userId) {
                throw new Error("Unauthorized access to this company's appointments");
            }
        }
        return await this.appointmentRepository.findAllByCompanyId(companyId, startDate, endDate);
    }
}
