export type AppointmentStatus = "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "POSTPONED";

export interface AppointmentItem {
  id: string;
  appointmentId: string;
  serviceId: string;
  serviceNameSnapshot: string;
  servicePriceSnapshot: string;
  serviceDurationSnapshot: string;
  createdAt: Date;
  updatedAt: Date;
}

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
  items?: AppointmentItem[];
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
  items?: Omit<AppointmentItem, "id" | "appointmentId" | "createdAt" | "updatedAt">[];
}
