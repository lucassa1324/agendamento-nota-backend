export class ListMyBusinessesUseCase {
    constructor(businessRepository) {
        this.businessRepository = businessRepository;
    }
    async execute(userId) {
        return await this.businessRepository.findAllByUserId(userId);
    }
}
