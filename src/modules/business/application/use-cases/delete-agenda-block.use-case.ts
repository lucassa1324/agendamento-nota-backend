import { IBusinessRepository } from "../../domain/ports/business.repository";

export class DeleteAgendaBlockUseCase {
  constructor(private businessRepository: IBusinessRepository) {}

  async execute(companyId: string, userId: string, blockId: string) {
    const success = await this.businessRepository.deleteAgendaBlock(companyId, userId, blockId);
    if (!success) {
      throw new Error("Agenda block not found or unauthorized");
    }
    return { success: true };
  }
}
