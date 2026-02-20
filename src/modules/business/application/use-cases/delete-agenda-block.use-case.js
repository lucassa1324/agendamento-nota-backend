export class DeleteAgendaBlockUseCase {
    constructor(businessRepository) {
        this.businessRepository = businessRepository;
    }
    async execute(companyId, userId, blockId) {
        const success = await this.businessRepository.deleteAgendaBlock(companyId, userId, blockId);
        if (!success) {
            throw new Error("Agenda block not found or unauthorized");
        }
        return { success: true };
    }
}
