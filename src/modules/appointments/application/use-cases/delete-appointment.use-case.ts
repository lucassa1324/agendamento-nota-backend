import { IAppointmentRepository } from "../../domain/ports/appointment.repository";
import { IBusinessRepository } from "../../../business/domain/ports/business.repository";

export class DeleteAppointmentUseCase {
  constructor(
    private appointmentRepository: IAppointmentRepository,
    private businessRepository: IBusinessRepository
  ) { }

  async execute(id: string, userId: string) {
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
