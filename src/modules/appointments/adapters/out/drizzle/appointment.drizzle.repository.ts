import { db } from "../../../../infrastructure/drizzle/database";
import { appointments } from "../../../../../db/schema";
import { eq, and } from "drizzle-orm";
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

  async findAllByCompanyId(companyId: string): Promise<Appointment[]> {
    const results = await db
      .select()
      .from(appointments)
      .where(eq(appointments.companyId, companyId));
    
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
}
