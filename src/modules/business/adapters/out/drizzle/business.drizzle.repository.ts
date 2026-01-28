import { db } from "../../../../infrastructure/drizzle/database";
import { companies, companySiteCustomizations, operatingHours, agendaBlocks } from "../../../../../db/schema";
import { and, eq } from "drizzle-orm";
import { IBusinessRepository } from "../../../domain/ports/business.repository";
import { Business, BusinessSummary, CreateBusinessInput, BusinessSiteCustomization } from "../../../domain/entities/business.entity";

export class DrizzleBusinessRepository implements IBusinessRepository {
  async findAllByUserId(userId: string): Promise<BusinessSummary[]> {
    const results = await db
      .select({
        id: companies.id,
        name: companies.name,
        slug: companies.slug,
        createdAt: companies.createdAt,
        siteCustomization: {
          layoutGlobal: companySiteCustomizations.layoutGlobal,
          home: companySiteCustomizations.home,
          gallery: companySiteCustomizations.gallery,
          aboutUs: companySiteCustomizations.aboutUs,
          appointmentFlow: companySiteCustomizations.appointmentFlow,
        }
      })
      .from(companies)
      .leftJoin(companySiteCustomizations, eq(companies.id, companySiteCustomizations.companyId))
      .where(eq(companies.ownerId, userId));

    return results as BusinessSummary[];
  }

  async findBySlug(slug: string): Promise<Business | null> {
    const result = await db
      .select({
        id: companies.id,
        name: companies.name,
        slug: companies.slug,
        ownerId: companies.ownerId,
        createdAt: companies.createdAt,
        updatedAt: companies.updatedAt,
        siteCustomization: {
          layoutGlobal: companySiteCustomizations.layoutGlobal,
          home: companySiteCustomizations.home,
          gallery: companySiteCustomizations.gallery,
          aboutUs: companySiteCustomizations.aboutUs,
          appointmentFlow: companySiteCustomizations.appointmentFlow,
        }
      })
      .from(companies)
      .leftJoin(companySiteCustomizations, eq(companies.id, companySiteCustomizations.companyId))
      .where(eq(companies.slug, slug))
      .limit(1);

    return (result[0] as Business) || null;
  }

  async findById(id: string): Promise<Business | null> {
    const result = await db
      .select({
        id: companies.id,
        name: companies.name,
        slug: companies.slug,
        ownerId: companies.ownerId,
        createdAt: companies.createdAt,
        updatedAt: companies.updatedAt,
        siteCustomization: {
          layoutGlobal: companySiteCustomizations.layoutGlobal,
          home: companySiteCustomizations.home,
          gallery: companySiteCustomizations.gallery,
          aboutUs: companySiteCustomizations.aboutUs,
          appointmentFlow: companySiteCustomizations.appointmentFlow,
        }
      })
      .from(companies)
      .leftJoin(companySiteCustomizations, eq(companies.id, companySiteCustomizations.companyId))
      .where(eq(companies.id, id))
      .limit(1);

    return (result[0] as Business) || null;
  }

  async create(data: CreateBusinessInput): Promise<Business> {
    return await db.transaction(async (tx) => {
      const [newCompany] = await tx.insert(companies).values({
        id: data.id,
        name: data.name,
        slug: data.slug,
        ownerId: data.ownerId,
      }).returning();

      const [newCustomization] = await tx.insert(companySiteCustomizations).values({
        id: crypto.randomUUID(),
        companyId: newCompany.id,
      }).returning();

      return {
        ...newCompany,
        siteCustomization: newCustomization
      } as Business;
    });
  }

  async updateConfig(id: string, userId: string, config: Partial<BusinessSiteCustomization>): Promise<Business | null> {
    return await db.transaction(async (tx) => {
      const [company] = await tx
        .select()
        .from(companies)
        .where(and(eq(companies.id, id), eq(companies.ownerId, userId)))
        .limit(1);

      if (!company) return null;

      const [updatedCustomization] = await tx
        .insert(companySiteCustomizations)
        .values({
          id: crypto.randomUUID(),
          companyId: id,
          ...config
        })
        .onConflictDoUpdate({
          target: companySiteCustomizations.companyId,
          set: config
        })
        .returning();

      return {
        ...company,
        siteCustomization: updatedCustomization
      } as Business;
    });
  }

  async setOperatingHours(
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
  ): Promise<boolean> {
    return await db.transaction(async (tx) => {
      const [company] = await tx
        .select()
        .from(companies)
        .where(and(eq(companies.id, companyId), eq(companies.ownerId, userId)))
        .limit(1);

      if (!company) return false;

      await tx.delete(operatingHours).where(eq(operatingHours.companyId, companyId));

      for (const h of hours) {
        await tx.insert(operatingHours).values({
          id: crypto.randomUUID(),
          companyId,
          dayOfWeek: h.dayOfWeek,
          status: h.status,
          morningStart: h.morningStart ?? null,
          morningEnd: h.morningEnd ?? null,
          afternoonStart: h.afternoonStart ?? null,
          afternoonEnd: h.afternoonEnd ?? null,
        });
      }

      return true;
    });
  }

  async getOperatingHours(
    companyId: string,
    userId: string
  ): Promise<
    Array<{
      id: string;
      dayOfWeek: string;
      status: string;
      morningStart?: string | null;
      morningEnd?: string | null;
      afternoonStart?: string | null;
      afternoonEnd?: string | null;
    }>
  > {
    const [company] = await db
      .select()
      .from(companies)
      .where(and(eq(companies.id, companyId), eq(companies.ownerId, userId)))
      .limit(1);

    if (!company) return [];

    const rows = await db
      .select()
      .from(operatingHours)
      .where(eq(operatingHours.companyId, companyId));

    return rows as any;
  }

  async createAgendaBlock(
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
  }> {
    return await db.transaction(async (tx) => {
      const [company] = await tx
        .select()
        .from(companies)
        .where(and(eq(companies.id, companyId), eq(companies.ownerId, userId)))
        .limit(1);

      if (!company) {
        throw new Error("Unauthorized to create agenda block for this company");
      }

      const [created] = await tx
        .insert(agendaBlocks)
        .values({
          id: crypto.randomUUID(),
          companyId,
          type: block.type,
          startDate: block.startDate,
          endDate: block.endDate,
          startTime: block.startTime ?? null,
          endTime: block.endTime ?? null,
          reason: block.reason ?? null,
        })
        .returning();

      return created as any;
    });
  }
}
