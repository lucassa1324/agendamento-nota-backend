import { IBusinessRepository } from "../../domain/ports/business.repository";

export class GetOperatingHoursUseCase {
  constructor(private businessRepository: IBusinessRepository) { }

  async execute(companyId: string, userId: string) {
    const result = await this.businessRepository.getOperatingHours(companyId, userId);
    if (!result) {
      throw new Error("Unauthorized or company not found");
    }
    return result;
  }
}
