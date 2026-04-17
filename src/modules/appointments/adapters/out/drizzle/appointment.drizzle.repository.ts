import { db } from "../../../../infrastructure/drizzle/database";
import { appointments, appointmentItems } from "../../../../../db/schema";
import { eq, and, gte, lte, sql, inArray } from "drizzle-orm";
import { IAppointmentRepository } from "../../../domain/ports/appointment.repository";
import { Appointment, CreateAppointmentInput, AppointmentStatus, AppointmentItem, UpdateAppointmentInput } from "../../../domain/entities/appointment.entity";

export class DrizzleAppointmentRepository implements IAppointmentRepository {
  async findById(id: string): Promise<Appointment | null> {
    const [result] = await db
      .select()
      .from(appointments)
      .where(eq(appointments.id, id))
      .limit(1);

    if (!result) return null;

    const items = await db
      .select()
      .from(appointmentItems)
      .where(eq(appointmentItems.appointmentId, id));

    return {
      ...(result as Appointment),
      items: items as AppointmentItem[],
    };
  }

  async findAllByCompanyId(companyId: string, startDate?: Date, endDate?: Date): Promise<Appointment[]> {
    const filters = [eq(appointments.companyId, companyId)];

    if (startDate) {
      filters.push(gte(appointments.scheduledAt, startDate));
    }

    if (endDate) {
      filters.push(lte(appointments.scheduledAt, endDate));
    }

    const results = await db
      .select()
      .from(appointments)
      .where(and(...filters));

    if (results.length === 0) return [];

    const appointmentIds = results.map(r => r.id);
    const allItems = await db
      .select()
      .from(appointmentItems)
      .where(inArray(appointmentItems.appointmentId, appointmentIds));

    return results.map(r => ({
      ...(r as Appointment),
      items: allItems.filter(item => item.appointmentId === r.id) as AppointmentItem[],
    }));
  }

  async findAllByCustomerId(customerId: string): Promise<Appointment[]> {
    const results = await db
      .select()
      .from(appointments)
      .where(eq(appointments.customerId, customerId));

    if (results.length === 0) return [];

    const appointmentIds = results.map(r => r.id);
    const allItems = await db
      .select()
      .from(appointmentItems)
      .where(inArray(appointmentItems.appointmentId, appointmentIds));

    return results.map(r => ({
      ...(r as Appointment),
      items: allItems.filter(item => item.appointmentId === r.id) as AppointmentItem[],
    }));
  }

  async create(data: CreateAppointmentInput): Promise<Appointment> {
    const { items, ...appointmentData } = data;
    const appointmentId = crypto.randomUUID();

    const [newAppointment] = await db
      .insert(appointments)
      .values({
        id: appointmentId,
        ...appointmentData,
      })
      .returning();

    let createdItems: AppointmentItem[] = [];

    if (items && items.length > 0) {
      const itemsToInsert = items.map(item => ({
        id: crypto.randomUUID(),
        appointmentId,
        ...item,
      }));

      const insertedItems = await db
        .insert(appointmentItems)
        .values(itemsToInsert)
        .returning();

      createdItems = insertedItems as AppointmentItem[];
    }

    return {
      ...(newAppointment as Appointment),
      items: createdItems,
    };
  }

  async update(id: string, data: UpdateAppointmentInput): Promise<Appointment | null> {
    return db.transaction(async (tx) => {
      const { items, ...appointmentData } = data;

      const [updated] = await tx
        .update(appointments)
        .set({
          ...appointmentData,
          notes: appointmentData.notes ?? null,
          updatedAt: new Date(),
        })
        .where(eq(appointments.id, id))
        .returning();

      if (!updated) return null;

      await tx
        .delete(appointmentItems)
        .where(eq(appointmentItems.appointmentId, id));

      let createdItems: AppointmentItem[] = [];
      if (items && items.length > 0) {
        const itemsToInsert = items.map((item) => ({
          id: crypto.randomUUID(),
          appointmentId: id,
          ...item,
        }));

        const insertedItems = await tx
          .insert(appointmentItems)
          .values(itemsToInsert)
          .returning();

        createdItems = insertedItems as AppointmentItem[];
      }

      return {
        ...(updated as Appointment),
        items: createdItems,
      };
    });
  }

  async updateSchedule(id: string, scheduledAt: Date): Promise<Appointment | null> {
    const [updated] = await db
      .update(appointments)
      .set({ scheduledAt, updatedAt: new Date() })
      .where(eq(appointments.id, id))
      .returning();

    return (updated as Appointment) || null;
  }

  async updateStatus(id: string, status: AppointmentStatus): Promise<Appointment | null> {
    const [updated] = await db
      .update(appointments)
      .set({ status, updatedAt: new Date() })
      .where(eq(appointments.id, id))
      .returning();

    return (updated as Appointment) || null;
  }

  async delete(id: string): Promise<void> {
    await db.delete(appointments).where(eq(appointments.id, id));
  }

  async sumRevenueByCompanyId(companyId: string, startDate?: Date, endDate?: Date): Promise<number> {
    const filters = [
      eq(appointments.companyId, companyId),
      eq(appointments.status, "COMPLETED")
    ];

    if (startDate) {
      filters.push(gte(appointments.scheduledAt, startDate));
    }

    if (endDate) {
      filters.push(lte(appointments.scheduledAt, endDate));
    }

    const [result] = await db
      .select({
        total: sql<string>`sum(${appointments.servicePriceSnapshot})`,
      })
      .from(appointments)
      .where(and(...filters));

    return parseFloat(result?.total || "0");
  }
}
