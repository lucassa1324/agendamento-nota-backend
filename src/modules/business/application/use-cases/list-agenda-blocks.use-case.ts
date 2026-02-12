import { IBusinessRepository } from "../../domain/ports/business.repository";

export class ListAgendaBlocksUseCase {
  constructor(private businessRepository: IBusinessRepository) { }

  async execute(companyId: string, userId?: string) {
    return await this.businessRepository.listAgendaBlocks(companyId, userId);
  }
}
