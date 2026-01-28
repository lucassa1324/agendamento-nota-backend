import { Service, CreateServiceInput } from "../entities/service.entity";

export interface IServiceRepository {
  findById(id: string): Promise<Service | null>;
  findAllByCompanyId(companyId: string): Promise<Service[]>;
  create(data: CreateServiceInput): Promise<Service>;
  update(id: string, data: Partial<CreateServiceInput>): Promise<Service | null>;
  delete(id: string): Promise<boolean>;
}
