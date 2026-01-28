import { IAppointmentRepository } from "../../domain/ports/appointment.repository";
import { IServiceRepository } from "../../../services/domain/ports/service.repository";
import { IBusinessRepository } from "../../../business/domain/ports/business.repository";
import { CreateAppointmentInput } from "../../domain/entities/appointment.entity";

export class CreateAppointmentUseCase {
  constructor(
    private appointmentRepository: IAppointmentRepository,
    private serviceRepository: IServiceRepository,
    private businessRepository: IBusinessRepository
  ) { }

  async execute(data: CreateAppointmentInput, userId: string) {
    // Valida se o usuário é o dono da empresa (Apenas admins criam manual)
    const business = await this.businessRepository.findById(data.companyId);
    if (!business || business.ownerId !== userId) {
      throw new Error("Unauthorized: Only business owners can create manual appointments");
    }

    // Valida se o serviço pertence à empresa
    const service = await this.serviceRepository.findById(data.serviceId);

    if (!service) {
      throw new Error("Service not found");
    }

    if (service.companyId !== data.companyId) {
      throw new Error("Service does not belong to this company");
    }

    return await this.appointmentRepository.create(data);
  }
}
