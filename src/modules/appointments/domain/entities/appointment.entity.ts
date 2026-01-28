export type AppointmentStatus = "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "POSTPONED";

export interface Appointment {
  id: string;
  companyId: string;
  serviceId: string;
  customerId: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  serviceNameSnapshot: string;
  servicePriceSnapshot: string;
  serviceDurationSnapshot: string;
  scheduledAt: Date;
  status: AppointmentStatus;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAppointmentInput {
  companyId: string;
  serviceId: string;
  customerId?: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  serviceNameSnapshot: string;
  servicePriceSnapshot: string;
  serviceDurationSnapshot: string;
  scheduledAt: Date;
  notes?: string;
}
