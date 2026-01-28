import { Business, BusinessSummary, CreateBusinessInput, BusinessSiteCustomization } from "../entities/business.entity";

export interface IBusinessRepository {
  findAllByUserId(userId: string): Promise<BusinessSummary[]>;
  findBySlug(slug: string): Promise<Business | null>;
  findById(id: string): Promise<Business | null>;
  create(data: CreateBusinessInput): Promise<Business>;
  updateConfig(id: string, userId: string, config: Partial<BusinessSiteCustomization>): Promise<Business | null>;
}
