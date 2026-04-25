import { IAppointmentRepository } from "../../domain/ports/appointment.repository";
import { IBusinessRepository } from "../../../business/domain/ports/business.repository";
import { assertUserHasCompanyAccess } from "../utils/company-access.util";

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

    await assertUserHasCompanyAccess(
      appointment.companyId,
      userId,
      "Unauthorized to delete this appointment",
    );

    await this.appointmentRepository.delete(id);
  }
}
