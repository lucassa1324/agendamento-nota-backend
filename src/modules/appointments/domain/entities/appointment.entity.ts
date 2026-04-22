export type AppointmentStatus = "PENDING" | "CONFIRMED" | "ONGOING" | "COMPLETED" | "CANCELLED" | "POSTPONED";

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
  staffId: string | null;
  customerId: string | null;
  createdBy: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  serviceNameSnapshot: string;
  servicePriceSnapshot: string;
  serviceDurationSnapshot: string;
  scheduledAt: Date;
  status: AppointmentStatus;
  auditLog: Array<{
    action: string;
    user: string;
    date: string;
  }>;
  notes: string | null;
  items?: AppointmentItem[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAppointmentInput {
  companyId: string;
  serviceId: string;
  staffId?: string | null;
  createdBy?: string | null;
  customerId?: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  serviceNameSnapshot: string;
  servicePriceSnapshot: string;
  serviceDurationSnapshot: string;
  scheduledAt: Date;
  auditLog?: Array<{
    action: string;
    user: string;
    date: string;
  }>;
  force?: boolean;
  notes?: string;
  ignoreBusinessHoursValidation?: boolean;
  items?: Omit<AppointmentItem, "id" | "appointmentId" | "createdAt" | "updatedAt">[];
}

export interface UpdateAppointmentInput {
  serviceId: string;
  staffId?: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  serviceNameSnapshot: string;
  servicePriceSnapshot: string;
  serviceDurationSnapshot: string;
  scheduledAt: Date;
  auditLog?: Array<{
    action: string;
    user: string;
    date: string;
  }>;
  notes?: string;
  items?: Omit<AppointmentItem, "id" | "appointmentId" | "createdAt" | "updatedAt">[];
}
