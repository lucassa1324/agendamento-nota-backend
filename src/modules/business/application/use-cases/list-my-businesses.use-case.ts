import { IBusinessRepository } from "../../domain/ports/business.repository";

export class ListMyBusinessesUseCase {
  constructor(private businessRepository: IBusinessRepository) { }

  async execute(userId: string) {
    return await this.businessRepository.findAllByUserId(userId);
  }
}
