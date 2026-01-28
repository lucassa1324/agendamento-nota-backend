import { IBusinessRepository } from "../../domain/ports/business.repository";

export class GetOperatingHoursUseCase {
  constructor(private businessRepository: IBusinessRepository) {}

  async execute(companyId: string, userId: string) {
    const weekly = await this.businessRepository.getOperatingHours(companyId, userId);
    return weekly ?? [];
  }
}
