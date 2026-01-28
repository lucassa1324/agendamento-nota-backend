import { IBusinessRepository } from "../../domain/ports/business.repository";
import { CreateBusinessDTO } from "../../adapters/in/dtos/business.dto";

export class CreateBusinessUseCase {
  constructor(private businessRepository: IBusinessRepository) { }

  async execute(userId: string, data: CreateBusinessDTO) {
    const existingBusiness = await this.businessRepository.findBySlug(data.slug);

    if (existingBusiness) {
      throw new Error("Slug already exists");
    }

    const newBusiness = await this.businessRepository.create({
      id: crypto.randomUUID(),
      name: data.name,
      slug: data.slug,
      ownerId: userId,
    });

    return newBusiness;
  }
}
