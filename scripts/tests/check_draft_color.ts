
import { db } from "../../src/modules/infrastructure/drizzle/database";
import { siteDrafts, companies } from "../../src/db/schema";
import { eq, ilike } from "drizzle-orm";

async function checkDraftColor() {
  console.log(">>> [CHECK_DRAFT_COLOR] Buscando rascunho do estúdio 'aura-teste'...");

  try {
    const [company] = await db
      .select()
      .from(companies)
      .where(ilike(companies.slug, "aura-teste"))
      .limit(1);

    if (!company) {
      console.log("❌ [ERROR] Estúdio 'aura-teste' não encontrado.");
      return;
    }

    const [draft] = await db
      .select()
      .from(siteDrafts)
      .where(eq(siteDrafts.companyId, company.id))
      .limit(1);

    if (!draft) {
      console.log("❌ [ERROR] Nenhum rascunho encontrado para este estúdio.");
      return;
    }

    const appointmentFlow = draft.appointmentFlow as any;
    console.log("- appointmentFlow completo:", JSON.stringify(appointmentFlow, null, 2));

  } catch (error) {
    console.error("❌ [ERROR] Falha ao consultar o banco de dados:", error);
  } finally {
    process.exit(0);
  }
}

checkDraftColor();
