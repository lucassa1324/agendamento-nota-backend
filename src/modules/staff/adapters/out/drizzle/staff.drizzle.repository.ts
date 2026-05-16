import { eq, and, ne } from "drizzle-orm";
import { db } from "../../../../infrastructure/drizzle/database";
import * as schema from "../../../../../db/schema";
import { IStaffRepository } from "../../../domain/ports/staff.repository";
import { Staff } from "../../../domain/entities/staff.entity";

export class StaffDrizzleRepository implements IStaffRepository {
  async existsByEmail(email: string): Promise<boolean> {
    const normalizedEmail = Staff.normalizeEmail(email);
    const result = await db
      .select({ count: schema.staff.id })
      .from(schema.staff)
      .where(eq(schema.staff.email, normalizedEmail))
      .limit(1);

    return result.length > 0;
  }

  async existsByEmailAndCompany(
    email: string,
    companyId: string,
  ): Promise<boolean> {
    const normalizedEmail = Staff.normalizeEmail(email);
    const result = await db
      .select({ count: schema.staff.id })
      .from(schema.staff)
      .where(
        and(
          eq(schema.staff.email, normalizedEmail),
          eq(schema.staff.companyId, companyId),
        ),
      )
      .limit(1);

    return result.length > 0;
  }

  async existsByEmailInOtherCompany(
    email: string,
    companyId: string,
    excludeStaffId?: string,
  ): Promise<boolean> {
    const normalizedEmail = Staff.normalizeEmail(email);

    const conditions = [
      eq(schema.staff.email, normalizedEmail),
      ne(schema.staff.companyId, companyId),
    ];

    if (excludeStaffId) {
      conditions.push(ne(schema.staff.id, excludeStaffId));
    }

    const result = await db
      .select({ count: schema.staff.id })
      .from(schema.staff)
      .where(and(...conditions))
      .limit(1);

    return result.length > 0;
  }

  async findByEmailAndCompany(
    email: string,
    companyId: string,
  ): Promise<Staff | null> {
    const normalizedEmail = Staff.normalizeEmail(email);
    const result = await db
      .select()
      .from(schema.staff)
      .where(
        and(
          eq(schema.staff.email, normalizedEmail),
          eq(schema.staff.companyId, companyId),
        ),
      )
      .limit(1);

    if (result.length === 0) return null;
    return this.mapToEntity(result[0]);
  }

  async findByEmailAnyCompany(
    email: string,
    excludeStaffId?: string,
  ): Promise<Staff[]> {
    const normalizedEmail = Staff.normalizeEmail(email);

    const conditions = [eq(schema.staff.email, normalizedEmail)];

    if (excludeStaffId) {
      conditions.push(ne(schema.staff.id, excludeStaffId));
    }

    const result = await db
      .select()
      .from(schema.staff)
      .where(and(...conditions));

    return result.map((row) => this.mapToEntity(row));
  }

  async findById(id: string): Promise<Staff | null> {
    const result = await db
      .select()
      .from(schema.staff)
      .where(eq(schema.staff.id, id))
      .limit(1);

    if (result.length === 0) return null;
    return this.mapToEntity(result[0]);
  }

  async findByCompany(companyId: string): Promise<Staff[]> {
    const result = await db
      .select()
      .from(schema.staff)
      .where(eq(schema.staff.companyId, companyId));

    return result.map((row) => this.mapToEntity(row));
  }

  private mapToEntity(
    row: typeof schema.staff.$inferSelect,
  ): Staff {
    return new Staff(
      row.id,
      row.companyId,
      row.name,
      row.email,
      row.isAdmin,
      row.isSecretary,
      row.isProfessional,
      row.calendarColor ?? null,
      row.commissionRate,
      row.isActive,
      row.createdAt,
      row.updatedAt,
    );
  }
}
