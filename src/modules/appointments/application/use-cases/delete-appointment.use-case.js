export class DeleteAppointmentUseCase {
    constructor(appointmentRepository, businessRepository) {
        this.appointmentRepository = appointmentRepository;
        this.businessRepository = businessRepository;
    }
    async execute(id, userId) {
        const appointment = await this.appointmentRepository.findById(id);
        if (!appointment) {
            throw new Error("Appointment not found");
        }
        // Verifica se o usuário é o dono da empresa do agendamento
        const business = await this.businessRepository.findById(appointment.companyId);
        if (!business || business.ownerId !== userId) {
            throw new Error("Unauthorized to delete this appointment");
        }
        await this.appointmentRepository.delete(id);
    }
}
