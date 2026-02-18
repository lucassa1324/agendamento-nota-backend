import { t } from "elysia";
export const createAppointmentDTO = t.Object({
    companyId: t.String(),
    serviceId: t.String(),
    customerId: t.Optional(t.Nullable(t.String())),
    scheduledAt: t.String(),
    customerName: t.String(),
    customerEmail: t.String(),
    customerPhone: t.String(),
    serviceNameSnapshot: t.String(),
    servicePriceSnapshot: t.String(),
    serviceDurationSnapshot: t.String(),
    notes: t.Optional(t.String()),
});
export const updateAppointmentStatusDTO = t.Object({
    status: t.Enum({
        PENDING: "PENDING",
        CONFIRMED: "CONFIRMED",
        COMPLETED: "COMPLETED",
        CANCELLED: "CANCELLED",
        POSTPONED: "POSTPONED"
    }),
});
