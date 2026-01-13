import { IBusinessRepository } from "../../domain/ports/business.repository";
import { UpdateBusinessConfigDTO } from "../../adapters/in/dtos/business.dto";

export class UpdateBusinessConfigUseCase {
  constructor(private businessRepository: IBusinessRepository) {}

  async execute(id: string, userId: string, data: UpdateBusinessConfigDTO) {
    const updatedBusiness = await this.businessRepository.updateConfig(
      id,
      userId,
      data.config
    );

    if (!updatedBusiness) {
      throw new Error("Business not found or unauthorized");
    }

    return updatedBusiness;
  }
}
