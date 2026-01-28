import { IAppointmentRepository } from "../../domain/ports/appointment.repository";
import { AppointmentStatus } from "../../domain/entities/appointment.entity";
import { IBusinessRepository } from "../../../business/domain/ports/business.repository";

export class UpdateAppointmentStatusUseCase {
  constructor(
    private appointmentRepository: IAppointmentRepository,
    private businessRepository: IBusinessRepository
  ) { }

  async execute(id: string, status: AppointmentStatus, userId: string) {
    const appointment = await this.appointmentRepository.findById(id);

    if (!appointment) {
      throw new Error("Appointment not found");
    }

    // Verifica se o usuário é o dono da empresa do agendamento
    const business = await this.businessRepository.findById(appointment.companyId);

    if (!business || business.ownerId !== userId) {
      throw new Error("Unauthorized to update this appointment status");
    }

    const updated = await this.appointmentRepository.updateStatus(id, status);
    return updated;
  }
}
