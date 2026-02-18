export class CreateServiceUseCase {
    constructor(serviceRepository) {
        this.serviceRepository = serviceRepository;
    }
    async execute(data) {
        return await this.serviceRepository.create(data);
    }
}
