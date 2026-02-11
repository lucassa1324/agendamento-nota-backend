import { db } from "../../../../infrastructure/drizzle/database";
import { appointments } from "../../../../../db/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { IAppointmentRepository } from "../../../domain/ports/appointment.repository";
import { Appointment, CreateAppointmentInput, AppointmentStatus } from "../../../domain/entities/appointment.entity";

export class DrizzleAppointmentRepository implements IAppointmentRepository {
  async findById(id: string): Promise<Appointment | null> {
    const [result] = await db
      .select()
      .from(appointments)
      .where(eq(appointments.id, id))
      .limit(1);

    return (result as Appointment) || null;
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

    return results as Appointment[];
  }

  async findAllByCustomerId(customerId: string): Promise<Appointment[]> {
    const results = await db
      .select()
      .from(appointments)
      .where(eq(appointments.customerId, customerId));

    return results as Appointment[];
  }

  async create(data: CreateAppointmentInput): Promise<Appointment> {
    const [newAppointment] = await db
      .insert(appointments)
      .values({
        id: crypto.randomUUID(),
        ...data,
      })
      .returning();

    return newAppointment as Appointment;
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
