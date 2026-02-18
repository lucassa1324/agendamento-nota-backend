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
        address: companies.address,
        contact: companies.contact,
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
        address: companies.address,
        contact: companies.contact,
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
      // Calcular data de fim do trial (+14 dias)
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 14);

      const [newCompany] = await tx.insert(companies).values({
        id: data.id,
        name: data.name,
        slug: data.slug,
        ownerId: data.ownerId,
        subscriptionStatus: 'trial',
        trialEndsAt: trialEndsAt,
        accessType: 'automatic',
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
  } | null> {
    const query = db
      .select({
        id: companies.id,
        siteCustomization: {
          appointmentFlow: companySiteCustomizations.appointmentFlow,
        }
      })
      .from(companies)
      .leftJoin(companySiteCustomizations, eq(companies.id, companySiteCustomizations.companyId));

    const conditions = [eq(companies.id, companyId)];
    if (userId) {
      conditions.push(eq(companies.ownerId, userId));
    }

    const [company] = await query
      .where(and(...conditions))
      .limit(1);

    if (!company) return null;

    const rows = await db
      .select()
      .from(operatingHours)
      .where(eq(operatingHours.companyId, companyId));

    const weekly = rows.map(row => ({
      id: row.id,
      dayOfWeek: String(row.dayOfWeek),
      status: row.status,
      morningStart: row.morningStart,
      morningEnd: row.morningEnd,
      afternoonStart: row.afternoonStart,
      afternoonEnd: row.afternoonEnd,
      // Adicionar mapeamento reverso para compatibilidade com o frontend (openTime/closeTime)
      openTime: row.morningStart,
      lunchStart: row.morningEnd,
      lunchEnd: row.afternoonStart,
      closeTime: row.afternoonEnd
    }));

    // Buscar também os bloqueios de agenda para o site poder desabilitar os horários
    const blocksRows = await db
      .select()
      .from(agendaBlocks)
      .where(eq(agendaBlocks.companyId, companyId));

    const blocks = blocksRows.map(block => ({
      id: block.id,
      type: block.type,
      startDate: block.startDate,
      endDate: block.endDate,
      startTime: block.startTime,
      endTime: block.endTime,
      reason: block.reason
    }));

    const appointmentFlow = (company.siteCustomization?.appointmentFlow as any) || {};
    // Suportar tanto a chave antiga quanto a nova (plural) e as variações de snake/camel case
    const step3 = appointmentFlow.step3Times || appointmentFlow.step3Time || appointmentFlow.step_3_time || {};
    let slotInterval = step3.timeSlotSize || step3.slot_interval || step3.slotInterval || "00:30";

    // Garantir formato HH:mm se for número (ex: 30 -> "00:30")
    if (typeof slotInterval === 'number') {
      const hours = Math.floor(slotInterval / 60);
      const minutes = slotInterval % 60;
      slotInterval = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    } else if (typeof slotInterval === 'string' && /^\d+$/.test(slotInterval)) {
      const totalMin = parseInt(slotInterval);
      const hours = Math.floor(totalMin / 60);
      const minutes = totalMin % 60;
      slotInterval = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }

    return {
      weekly,
      slotInterval,
      interval: slotInterval,
      blocks
    };
  }

  async listAgendaBlocks(
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
  }>> {
    const conditions = [eq(companies.id, companyId)];
    if (userId) {
      conditions.push(eq(companies.ownerId, userId));
    }

    const [company] = await db
      .select()
      .from(companies)
      .where(and(...conditions))
      .limit(1);

    if (!company) return [];

    const blocks = await db
      .select()
      .from(agendaBlocks)
      .where(eq(agendaBlocks.companyId, companyId));

    return blocks as any;
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

  async deleteAgendaBlock(
    companyId: string,
    userId: string,
    blockId: string
  ): Promise<boolean> {
    return await db.transaction(async (tx) => {
      const [company] = await tx
        .select()
        .from(companies)
        .where(and(eq(companies.id, companyId), eq(companies.ownerId, userId)))
        .limit(1);

      if (!company) {
        throw new Error("Unauthorized to delete agenda block for this company");
      }

      const result = await tx
        .delete(agendaBlocks)
        .where(and(eq(agendaBlocks.id, blockId), eq(agendaBlocks.companyId, companyId)))
        .returning();

      return result.length > 0;
    });
  }
}
