import { and, eq, lte } from "drizzle-orm";
import { db } from "../modules/infrastructure/drizzle/database";
import { companies } from "../db/schema";

const RETENTION_DAYS = 365;

const buildCutoffDate = () => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);
  return cutoffDate;
};

async function purgeBlockedCompanies() {
  const cutoffDate = buildCutoffDate();

  const deleted = await db
    .delete(companies)
    .where(
      and(
        eq(companies.subscriptionStatus, "blocked"),
        lte(companies.blockedAt, cutoffDate),
      ),
    )
    .returning({ id: companies.id, slug: companies.slug, blockedAt: companies.blockedAt });

  console.log(
    `[PURGE_BLOCKED_COMPANIES] Empresas removidas: ${deleted.length}. cutoff=${cutoffDate.toISOString()}`,
  );

  if (deleted.length > 0) {
    console.log("[PURGE_BLOCKED_COMPANIES] IDs removidos:", deleted.map((item) => item.id));
  }
}

purgeBlockedCompanies()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("[PURGE_BLOCKED_COMPANIES] Falha ao executar purga:", error);
    process.exit(1);
  });
