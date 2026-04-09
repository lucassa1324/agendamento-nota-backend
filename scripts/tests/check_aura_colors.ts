
import * as dotenv from "dotenv";
dotenv.config({ path: "back_end/.env.local" });

import { companies, siteDrafts } from "../../src/db/schema";
import { eq, ilike } from "drizzle-orm";

async function checkAuraColors() {
  const { db } = await import("../../src/modules/infrastructure/drizzle/database");
  console.log(">>> [CHECK_AURA_COLORS] Buscando dados do estúdio 'aura-teste'...");

  try {
    const [company] = await db
      .select()
      .from(companies)
      .where(ilike(companies.slug, "aura-teste"))
      .limit(1);

    if (!company) {
      console.log("❌ Estúdio 'aura-teste' não encontrado.");
      process.exit(0);
    }

    const [draft] = await db
      .select()
      .from(siteDrafts)
      .where(eq(siteDrafts.companyId, company.id))
      .limit(1);

    if (!draft) {
      console.log("❌ Rascunho não encontrado.");
      process.exit(0);
    }

    const home = (draft.home as any) || {};

    console.log("\n--- [DADOS DA SEÇÃO VALORES EM HOME] ---");

    if (home.homeValuesSettings) {
      console.log("✅ [home.homeValuesSettings]:", JSON.stringify(home.homeValuesSettings, null, 2));
    } else {
      console.log("❌ [home.homeValuesSettings] não encontrado.");
    }

    if (home.valuesSection) {
      console.log("✅ [home.valuesSection]:", JSON.stringify(home.valuesSection, null, 2));
    } else {
      console.log("❌ [home.valuesSection] não encontrado.");
    }

    console.log("\n--- [DADOS DA SEÇÃO VALORES NA RAIZ DO DRAFT] ---");
    const rootKeys = Object.keys(draft);
    const valueKeys = rootKeys.filter(k => k.toLowerCase().includes("value"));

    valueKeys.forEach(k => {
      console.log(`✅ [RAIZ.${k}]:`, JSON.stringify((draft as any)[k], null, 2));
    });

    if (valueKeys.length === 0) {
      console.log("ℹ️ Nenhuma chave 'value' encontrada na raiz do draft.");
    }

  } catch (error) {
    console.error("❌ Erro ao verificar cores:", error);
  } finally {
    process.exit(0);
  }
}

checkAuraColors();
