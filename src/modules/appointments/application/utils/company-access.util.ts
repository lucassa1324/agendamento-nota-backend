import { and, eq } from "drizzle-orm";
import { companies, staff } from "../../../../db/schema";
import { db } from "../../../infrastructure/drizzle/database";

export type CompanyAccessLevel = "owner" | "staff";

export async function resolveCompanyAccessLevel(
  companyId: string,
  userId: string,
): Promise<CompanyAccessLevel | null> {
  const [ownerMatch] = await db
    .select({ id: companies.id })
    .from(companies)
    .where(and(eq(companies.id, companyId), eq(companies.ownerId, userId)))
    .limit(1);

  if (ownerMatch) {
    return "owner";
  }

  const [staffMatch] = await db
    .select({ id: staff.id })
    .from(staff)
    .where(
      and(
        eq(staff.companyId, companyId),
        eq(staff.userId, userId),
        eq(staff.isActive, true),
      ),
    )
    .limit(1);

  if (staffMatch) {
    return "staff";
  }

  return null;
}

export async function assertUserHasCompanyAccess(
  companyId: string,
  userId: string,
  unauthorizedMessage: string,
): Promise<CompanyAccessLevel> {
  const accessLevel = await resolveCompanyAccessLevel(companyId, userId);
  if (!accessLevel) {
    throw new Error(unauthorizedMessage);
  }
  return accessLevel;
}
