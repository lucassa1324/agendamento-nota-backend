import { Elysia, t } from "elysia";
import { db } from "../../../../infrastructure/drizzle/database";
import { appointments } from "../../../../../db/schema";
import { eq, or } from "drizzle-orm";
import { authPlugin } from "../../../../infrastructure/auth/auth-plugin";
import type { User } from "../../../../infrastructure/auth/auth-plugin";

export const appointmentController = new Elysia({ prefix: "/appointments" })
  .use(authPlugin)
  .get("/", async ({ user, set }: { user: User | null; set: any }) => {
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    // Busca agendamentos onde o usuário é o cliente (customerId)
    // No futuro, se o usuário for ADMIN, ele poderá ver todos os agendamentos da empresa dele
    const data = await db
      .select()
      .from(appointments)
      .where(eq(appointments.customerId, user.id));

    return data;
  }, {
    auth: true
  })
  .post("/", async ({ user, body, set }: { user: User | null; body: any; set: any }) => {
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    const newAppointment = await db.insert(appointments).values({
      id: crypto.randomUUID(),
      companyId: body.companyId,
      serviceId: body.serviceId,
      customerId: user.id,
      customerName: user.name || "Cliente",
      customerEmail: user.email,
      customerPhone: body.customerPhone || "",
      serviceNameSnapshot: body.serviceName,
      servicePriceSnapshot: body.servicePrice,
      serviceDurationSnapshot: body.serviceDuration,
      scheduledAt: new Date(body.scheduledAt),
      status: "PENDING",
      notes: body.notes,
    }).returning();

    return newAppointment[0];
  }, {
    auth: true,
    body: t.Object({
      companyId: t.String(),
      serviceId: t.String(),
      scheduledAt: t.String(),
      customerPhone: t.Optional(t.String()),
      serviceName: t.String(),
      servicePrice: t.String(),
      serviceDuration: t.String(),
      notes: t.Optional(t.String()),
    })
  });
