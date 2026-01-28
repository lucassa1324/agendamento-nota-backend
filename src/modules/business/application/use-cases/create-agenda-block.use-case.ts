import { IBusinessRepository } from "../../domain/ports/business.repository";
import { CreateAgendaBlockDTO } from "../../adapters/in/dtos/business.settings.dto";

export class CreateAgendaBlockUseCase {
  constructor(private businessRepository: IBusinessRepository) {}

  async execute(companyId: string, userId: string, data: CreateAgendaBlockDTO) {
    const created = await this.businessRepository.createAgendaBlock(companyId, userId, data);
    return created;
  }
}
