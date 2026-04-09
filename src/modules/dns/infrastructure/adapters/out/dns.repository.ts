import { db } from "../../../../infrastructure/drizzle/database";
import { customDomains } from "../../../../../db/schema";
import { eq, and } from "drizzle-orm";



export class DnsRepository {
  async findByCompanyId(companyId: string) {
    const [record] = await db
      .select()
      .from(customDomains)
      .where(eq(customDomains.companyId, companyId))
      .limit(1);
    return record ?? null;
  }

  async findByDomain(domain: string) {
    const [record] = await db
      .select()
      .from(customDomains)
      .where(eq(customDomains.domain, domain))
      .limit(1);
    return record ?? null;
  }

  async create(data: { id: string; companyId: string; domain: string; status: "PENDING" | "ACTIVE" | "ERROR"; verificationData?: any }) {
    const [record] = await db.insert(customDomains).values(data).returning();
    return record;
  }

  async update(id: string, data: Partial<{ status: "PENDING" | "ACTIVE" | "ERROR"; verificationData: any }>) {
    const [record] = await db
      .update(customDomains)
      .set(data)
      .where(eq(customDomains.id, id))
      .returning();
    return record;
  }

  async delete(id: string) {
    return await db.delete(customDomains).where(eq(customDomains.id, id));
  }

  async deleteByCompanyIdAndDomain(companyId: string, domain: string) {
    return await db.delete(customDomains).where(
      and(
        eq(customDomains.companyId, companyId),
        eq(customDomains.domain, domain)
      )
    );
  }
}
