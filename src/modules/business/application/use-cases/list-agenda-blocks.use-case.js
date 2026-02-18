export class ListAgendaBlocksUseCase {
    constructor(businessRepository) {
        this.businessRepository = businessRepository;
    }
    async execute(companyId, userId) {
        return await this.businessRepository.listAgendaBlocks(companyId, userId);
    }
}
