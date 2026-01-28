import { Appointment, CreateAppointmentInput, AppointmentStatus } from "../entities/appointment.entity";

export interface IAppointmentRepository {
  findById(id: string): Promise<Appointment | null>;
  findAllByCompanyId(companyId: string, startDate?: Date, endDate?: Date): Promise<Appointment[]>;
  findAllByCustomerId(customerId: string): Promise<Appointment[]>;
  create(data: CreateAppointmentInput): Promise<Appointment>;
  updateStatus(id: string, status: AppointmentStatus): Promise<Appointment | null>;
  delete(id: string): Promise<void>;
}
