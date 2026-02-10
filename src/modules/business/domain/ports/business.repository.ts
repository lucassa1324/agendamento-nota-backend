import { Business, BusinessSummary, CreateBusinessInput, BusinessSiteCustomization } from "../entities/business.entity";

export interface IBusinessRepository {
  findAllByUserId(userId: string): Promise<BusinessSummary[]>;
  findBySlug(slug: string): Promise<Business | null>;
  findById(id: string): Promise<Business | null>;
  create(data: CreateBusinessInput): Promise<Business>;
  updateConfig(id: string, userId: string, config: Partial<BusinessSiteCustomization>): Promise<Business | null>;
  setOperatingHours(
    companyId: string,
    userId: string,
    hours: Array<{
      dayOfWeek: string;
      status: string;
      morningStart?: string | null;
      morningEnd?: string | null;
      afternoonStart?: string | null;
      afternoonEnd?: string | null;
    }>
  ): Promise<boolean>;
  getOperatingHours(
    companyId: string,
    userId?: string
  ): Promise<{
    weekly: Array<{
      id: string;
      dayOfWeek: string;
      status: string;
      morningStart?: string | null;
      morningEnd?: string | null;
      afternoonStart?: string | null;
      afternoonEnd?: string | null;
      openTime?: string | null;
      lunchStart?: string | null;
      lunchEnd?: string | null;
      closeTime?: string | null;
    }>;
    slotInterval: string;
    interval: string;
    blocks: Array<{
      id: string;
      type: string;
      startDate: string;
      endDate: string;
      startTime?: string | null;
      endTime?: string | null;
      reason?: string | null;
    }>;
  } | null>;
  listAgendaBlocks(
    companyId: string,
    userId?: string
  ): Promise<Array<{
    id: string;
    companyId: string;
    type: string;
    startDate: string;
    endDate: string;
    startTime?: string | null;
    endTime?: string | null;
    reason?: string | null;
    createdAt: Date;
    updatedAt: Date;
  }>>;
  createAgendaBlock(
    companyId: string,
    userId: string,
    block: {
      type: "BLOCK_HOUR" | "BLOCK_DAY" | "BLOCK_PERIOD";
      startDate: string;
      endDate: string;
      startTime?: string | null;
      endTime?: string | null;
      reason?: string | null;
    }
  ): Promise<{
    id: string;
    companyId: string;
    type: string;
    startDate: string;
    endDate: string;
    startTime?: string | null;
    endTime?: string | null;
    reason?: string | null;
    createdAt: Date;
    updatedAt: Date;
  }>;
  deleteAgendaBlock(
    companyId: string,
    userId: string,
    blockId: string
  ): Promise<boolean>;
}
