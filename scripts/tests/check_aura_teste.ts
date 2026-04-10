
import { db } from "../../src/modules/infrastructure/drizzle/database";
import { companies } from "../../src/db/schema";
import { eq, ilike } from "drizzle-orm";

async function checkStudio() {
  console.log(">>> [CHECK_STUDIO] Verificando existência do estúdio 'aura-teste'...");

  try {
    const results = await db
      .select()
      .from(companies)
      .where(ilike(companies.slug, "aura-teste"))
      .limit(1);

    if (results.length > 0) {
      console.log("✅ [SUCCESS] Estúdio encontrado!");
      console.log(JSON.stringify(results[0], null, 2));
    } else {
      console.log("❌ [NOT_FOUND] Estúdio 'aura-teste' não existe no banco de dados.");

      // Listar todos os estúdios para ver o que tem no banco
      const allStudios = await db.select({ name: companies.name, slug: companies.slug }).from(companies);
      console.log(">>> [DATABASE] Estúdios cadastrados:");
      console.table(allStudios);
    }
  } catch (error) {
    console.error("❌ [ERROR] Falha ao consultar o banco de dados:", error);
  } finally {
    process.exit(0);
  }
}

checkStudio();
