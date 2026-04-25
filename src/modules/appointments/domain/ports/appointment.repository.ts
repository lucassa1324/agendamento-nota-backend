import { Appointment, CreateAppointmentInput, AppointmentStatus, UpdateAppointmentInput } from "../entities/appointment.entity";

export interface IAppointmentRepository {
  findById(id: string): Promise<Appointment | null>;
  findAllByCompanyId(companyId: string, startDate?: Date, endDate?: Date): Promise<Appointment[]>;
  findAllByCustomerId(customerId: string): Promise<Appointment[]>;
  create(data: CreateAppointmentInput, tx?: any): Promise<Appointment>;
  update(id: string, data: UpdateAppointmentInput): Promise<Appointment | null>;
  updateSchedule(
    id: string,
    scheduledAt: Date,
    auditLog?: Array<{ action: string; user: string; date: string }>,
  ): Promise<Appointment | null>;
  updateStatus(id: string, status: AppointmentStatus): Promise<Appointment | null>;
  delete(id: string): Promise<void>;
  sumRevenueByCompanyId(companyId: string, startDate?: Date, endDate?: Date): Promise<number>;
}
