import { db } from "../../../../infrastructure/drizzle/database";
import { appointments } from "../../../../../db/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";
export class DrizzleAppointmentRepository {
    async findById(id) {
        const [result] = await db
            .select()
            .from(appointments)
            .where(eq(appointments.id, id))
            .limit(1);
        return result || null;
    }
    async findAllByCompanyId(companyId, startDate, endDate) {
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
        return results;
    }
    async findAllByCustomerId(customerId) {
        const results = await db
            .select()
            .from(appointments)
            .where(eq(appointments.customerId, customerId));
        return results;
    }
    async create(data) {
        const [newAppointment] = await db
            .insert(appointments)
            .values({
            id: crypto.randomUUID(),
            ...data,
        })
            .returning();
        return newAppointment;
    }
    async updateStatus(id, status) {
        const [updated] = await db
            .update(appointments)
            .set({ status, updatedAt: new Date() })
            .where(eq(appointments.id, id))
            .returning();
        return updated || null;
    }
    async delete(id) {
        await db.delete(appointments).where(eq(appointments.id, id));
    }
    async sumRevenueByCompanyId(companyId, startDate, endDate) {
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
            total: sql `sum(${appointments.servicePriceSnapshot})`,
        })
            .from(appointments)
            .where(and(...filters));
        return parseFloat(result?.total || "0");
    }
}
