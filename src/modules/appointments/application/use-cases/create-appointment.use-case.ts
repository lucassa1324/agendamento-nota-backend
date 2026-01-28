import { IAppointmentRepository } from "../../domain/ports/appointment.repository";
import { CreateAppointmentInput } from "../../domain/entities/appointment.entity";

export class CreateAppointmentUseCase {
  constructor(private appointmentRepository: IAppointmentRepository) {}

  async execute(data: CreateAppointmentInput) {
    return await this.appointmentRepository.create(data);
  }
}
