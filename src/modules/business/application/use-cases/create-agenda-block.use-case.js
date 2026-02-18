export class CreateAgendaBlockUseCase {
    constructor(businessRepository) {
        this.businessRepository = businessRepository;
    }
    async execute(companyId, userId, data) {
        const created = await this.businessRepository.createAgendaBlock(companyId, userId, data);
        return created;
    }
}
