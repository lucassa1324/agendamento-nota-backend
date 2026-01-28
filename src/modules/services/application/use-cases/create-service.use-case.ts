import { IServiceRepository } from "../../domain/ports/service.repository";
import { CreateServiceInput } from "../../domain/entities/service.entity";

export class CreateServiceUseCase {
  constructor(private serviceRepository: IServiceRepository) {}

  async execute(data: CreateServiceInput) {
    return await this.serviceRepository.create(data);
  }
}
