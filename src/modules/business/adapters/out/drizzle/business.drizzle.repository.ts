import { db } from "../../../../infrastructure/drizzle/database";
import { companies, companySiteCustomizations } from "../../../../../db/schema";
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
}
