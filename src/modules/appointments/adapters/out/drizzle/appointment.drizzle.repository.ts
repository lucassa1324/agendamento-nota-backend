import { db } from "../../../../infrastructure/drizzle/database";
import { appointments, appointmentItems } from "../../../../../db/schema";
import { eq, and, gte, lte, sql, inArray } from "drizzle-orm";
import { IAppointmentRepository } from "../../../domain/ports/appointment.repository";
import { Appointment, CreateAppointmentInput, AppointmentStatus, AppointmentItem, UpdateAppointmentInput } from "../../../domain/entities/appointment.entity";

type AppointmentSchemaCapabilities = {
  hasStaffId: boolean;
  hasCreatedBy: boolean;
  hasAuditLog: boolean;
  hasAssignedBy: boolean;
  hasValidationStatus: boolean;
  hasVersion: boolean;
};

export class DrizzleAppointmentRepository implements IAppointmentRepository {
  private static schemaCapabilitiesPromise: Promise<AppointmentSchemaCapabilities> | null = null;

  private async getSchemaCapabilities(): Promise<AppointmentSchemaCapabilities> {
    if (DrizzleAppointmentRepository.schemaCapabilitiesPromise) {
      return DrizzleAppointmentRepository.schemaCapabilitiesPromise;
    }

    DrizzleAppointmentRepository.schemaCapabilitiesPromise = (async () => {
      const result = await db.execute(
        sql`select column_name from information_schema.columns where table_schema = 'public' and table_name = 'appointments'`,
      );
      const rows = (result as { rows?: Array<{ column_name: string }> }).rows ?? [];
      const columns = new Set(rows.map((row) => row.column_name));

      return {
        hasStaffId: columns.has("staff_id"),
        hasCreatedBy: columns.has("created_by"),
        hasAuditLog: columns.has("audit_log"),
        hasAssignedBy: columns.has("assigned_by"),
        hasValidationStatus: columns.has("validation_status"),
        hasVersion: columns.has("version"),
      };
    })();

    return DrizzleAppointmentRepository.schemaCapabilitiesPromise;
  }

  private getSelectableFields(capabilities: AppointmentSchemaCapabilities) {
    const fields: Record<string, unknown> = {
      id: appointments.id,
      companyId: appointments.companyId,
      serviceId: appointments.serviceId,
      customerId: appointments.customerId,
      customerName: appointments.customerName,
      customerEmail: appointments.customerEmail,
      customerPhone: appointments.customerPhone,
      serviceNameSnapshot: appointments.serviceNameSnapshot,
      servicePriceSnapshot: appointments.servicePriceSnapshot,
      serviceDurationSnapshot: appointments.serviceDurationSnapshot,
      scheduledAt: appointments.scheduledAt,
      status: appointments.status,
      notes: appointments.notes,
      createdAt: appointments.createdAt,
      updatedAt: appointments.updatedAt,
    };

    if (capabilities.hasStaffId) fields.staffId = appointments.staffId;
    if (capabilities.hasCreatedBy) fields.createdBy = appointments.createdBy;
    if (capabilities.hasAuditLog) fields.auditLog = appointments.auditLog;
    if (capabilities.hasAssignedBy) fields.assignedBy = appointments.assignedBy;
    if (capabilities.hasValidationStatus) fields.validationStatus = appointments.validationStatus;
    if (capabilities.hasVersion) fields.version = appointments.version;

    return fields;
  }

  private toAppointment(row: Record<string, unknown>): Appointment {
    return {
      ...(row as unknown as Omit<Appointment, "staffId" | "createdBy" | "auditLog">),
      staffId: (row.staffId as string | null | undefined) ?? null,
      createdBy: (row.createdBy as string | null | undefined) ?? null,
      assignedBy: (row.assignedBy as "system" | "staff" | undefined) ?? "staff",
      validationStatus: (row.validationStatus as "suggested" | "confirmed" | undefined) ?? "confirmed",
      version: (row.version as number | undefined) ?? 1,
      auditLog: (row.auditLog as Array<{ action: string; user: string; date: string }> | undefined) ?? [],
    };
  }

  async findById(id: string): Promise<Appointment | null> {
    const capabilities = await this.getSchemaCapabilities();
    const selectFields = this.getSelectableFields(capabilities);

    const [result] = await db
      .select(selectFields as any)
      .from(appointments)
      .where(eq(appointments.id, id))
      .limit(1);

    if (!result) return null;

    const items = await db
      .select()
      .from(appointmentItems)
      .where(eq(appointmentItems.appointmentId, id));

    return { ...this.toAppointment(result as Record<string, unknown>), items: items as AppointmentItem[] };
  }

  async findAllByCompanyId(companyId: string, startDate?: Date, endDate?: Date): Promise<Appointment[]> {
    const capabilities = await this.getSchemaCapabilities();
    const selectFields = this.getSelectableFields(capabilities);
    const filters = [eq(appointments.companyId, companyId)];

    if (startDate) {
      filters.push(gte(appointments.scheduledAt, startDate));
    }

    if (endDate) {
      filters.push(lte(appointments.scheduledAt, endDate));
    }

    const results = await db
      .select(selectFields as any)
      .from(appointments)
      .where(and(...filters));

    if (results.length === 0) return [];

    const appointmentIds = results.map(r => r.id);
    const allItems = await db
      .select()
      .from(appointmentItems)
      .where(inArray(appointmentItems.appointmentId, appointmentIds));

    return results.map((r) => ({
      ...this.toAppointment(r as Record<string, unknown>),
      items: allItems.filter((item) => item.appointmentId === r.id) as AppointmentItem[],
    }));
  }

  async findAllByCustomerId(customerId: string): Promise<Appointment[]> {
    const capabilities = await this.getSchemaCapabilities();
    const selectFields = this.getSelectableFields(capabilities);
    const results = await db
      .select(selectFields as any)
      .from(appointments)
      .where(eq(appointments.customerId, customerId));

    if (results.length === 0) return [];

    const appointmentIds = results.map(r => r.id);
    const allItems = await db
      .select()
      .from(appointmentItems)
      .where(inArray(appointmentItems.appointmentId, appointmentIds));

    return results.map((r) => ({
      ...this.toAppointment(r as Record<string, unknown>),
      items: allItems.filter((item) => item.appointmentId === r.id) as AppointmentItem[],
    }));
  }

  async create(data: CreateAppointmentInput, tx?: any): Promise<Appointment> {
    const capabilities = await this.getSchemaCapabilities();
    const selectFields = this.getSelectableFields(capabilities);
    const { items, ...appointmentData } = data;
    const appointmentId = crypto.randomUUID();
    const executor = tx ?? db;

    const insertValues: Record<string, unknown> = {
      id: appointmentId,
      companyId: appointmentData.companyId,
      serviceId: appointmentData.serviceId,
      customerId: appointmentData.customerId ?? null,
      customerName: appointmentData.customerName,
      customerEmail: appointmentData.customerEmail,
      customerPhone: appointmentData.customerPhone,
      serviceNameSnapshot: appointmentData.serviceNameSnapshot,
      servicePriceSnapshot: appointmentData.servicePriceSnapshot,
      serviceDurationSnapshot: appointmentData.serviceDurationSnapshot,
      scheduledAt: appointmentData.scheduledAt,
      status: "PENDING",
      notes: appointmentData.notes ?? null,
    };

    if (capabilities.hasStaffId) {
      insertValues.staffId = appointmentData.staffId ?? null;
    }
    if (capabilities.hasCreatedBy) {
      insertValues.createdBy = appointmentData.createdBy ?? null;
    }
    if (capabilities.hasAuditLog) {
      insertValues.auditLog = appointmentData.auditLog ?? [];
    }
    if (capabilities.hasAssignedBy) {
      insertValues.assignedBy = appointmentData.assignedBy ?? "staff";
    }
    if (capabilities.hasValidationStatus) {
      insertValues.validationStatus = appointmentData.validationStatus ?? "confirmed";
    }
    if (capabilities.hasVersion) {
      insertValues.version = appointmentData.version ?? 1;
    }

    const [newAppointment] = await executor
      .insert(appointments)
      .values(insertValues as any)
      .returning(selectFields as any);

    let createdItems: AppointmentItem[] = [];

    if (items && items.length > 0) {
      const itemsToInsert = items.map(item => ({
        id: crypto.randomUUID(),
        appointmentId,
        ...item,
      }));

      const insertedItems = await executor
        .insert(appointmentItems)
        .values(itemsToInsert)
        .returning();

      createdItems = insertedItems as AppointmentItem[];
    }

    return { ...this.toAppointment(newAppointment as Record<string, unknown>), items: createdItems };
  }

  async update(id: string, data: UpdateAppointmentInput): Promise<Appointment | null> {
    const capabilities = await this.getSchemaCapabilities();
    const selectFields = this.getSelectableFields(capabilities);
    return db.transaction(async (tx) => {
      const { items, ...appointmentData } = data;

      const updateSet: Record<string, unknown> = {
        serviceId: appointmentData.serviceId,
        customerName: appointmentData.customerName,
        customerEmail: appointmentData.customerEmail,
        customerPhone: appointmentData.customerPhone,
        serviceNameSnapshot: appointmentData.serviceNameSnapshot,
        servicePriceSnapshot: appointmentData.servicePriceSnapshot,
        serviceDurationSnapshot: appointmentData.serviceDurationSnapshot,
        scheduledAt: appointmentData.scheduledAt,
        notes: appointmentData.notes ?? null,
        updatedAt: new Date(),
      };

      if (capabilities.hasStaffId && "staffId" in appointmentData) {
        updateSet.staffId = appointmentData.staffId ?? null;
      }
      if (capabilities.hasAuditLog && appointmentData.auditLog !== undefined) {
        updateSet.auditLog = appointmentData.auditLog;
      }
      if (capabilities.hasAssignedBy && appointmentData.assignedBy !== undefined) {
        updateSet.assignedBy = appointmentData.assignedBy;
      }
      if (
        capabilities.hasValidationStatus &&
        appointmentData.validationStatus !== undefined
      ) {
        updateSet.validationStatus = appointmentData.validationStatus;
      }
      if (capabilities.hasVersion && appointmentData.version !== undefined) {
        updateSet.version = appointmentData.version;
      }

      const [updated] = await tx
        .update(appointments)
        .set(updateSet as any)
        .where(eq(appointments.id, id))
        .returning(selectFields as any);

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

      return { ...this.toAppointment(updated as Record<string, unknown>), items: createdItems };
    });
  }

  async updateSchedule(
    id: string,
    scheduledAt: Date,
    auditLog?: Array<{ action: string; user: string; date: string }>,
  ): Promise<Appointment | null> {
    const capabilities = await this.getSchemaCapabilities();
    const selectFields = this.getSelectableFields(capabilities);
    const updateSet: Record<string, unknown> = {
      scheduledAt,
      updatedAt: new Date(),
    };
    if (capabilities.hasAuditLog && auditLog !== undefined) {
      updateSet.auditLog = auditLog;
    }

    const [updated] = await db
      .update(appointments)
      .set(updateSet as any)
      .where(eq(appointments.id, id))
      .returning(selectFields as any);

    return updated ? this.toAppointment(updated as Record<string, unknown>) : null;
  }

  async updateStatus(id: string, status: AppointmentStatus): Promise<Appointment | null> {
    const capabilities = await this.getSchemaCapabilities();
    const selectFields = this.getSelectableFields(capabilities);
    const [updated] = await db
      .update(appointments)
      .set({ status, updatedAt: new Date() })
      .where(eq(appointments.id, id))
      .returning(selectFields as any);

    return updated ? this.toAppointment(updated as Record<string, unknown>) : null;
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
