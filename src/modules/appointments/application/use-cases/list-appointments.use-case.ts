import { IAppointmentRepository } from "../../domain/ports/appointment.repository";
import { IBusinessRepository } from "../../../business/domain/ports/business.repository";

export class ListAppointmentsUseCase {
  constructor(
    private appointmentRepository: IAppointmentRepository,
    private businessRepository: IBusinessRepository
  ) { }

  async execute(companyId: string, userId?: string, startDate?: Date, endDate?: Date) {
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
