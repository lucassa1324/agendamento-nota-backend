
import { db } from "../src/modules/infrastructure/drizzle/database";
import * as schema from "../src/db/schema";
import { eq } from "drizzle-orm";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(__dirname, "../.env.local") });

async function checkAuraCustomization() {
  try {
    console.log("Buscando usuário aura.teste@gmail.com...");
    const [user] = await db
      .select()
      .from(schema.user)
      .where(eq(schema.user.email, "aura.teste@gmail.com"));

    if (!user) {
      console.log("Usuário não encontrado.");
      return;
    }

    console.log(`Usuário encontrado: ${user.id}`);

    const [company] = await db
      .select()
      .from(schema.companies)
      .where(eq(schema.companies.ownerId, user.id));

    if (!company) {
      console.log("Empresa não encontrada para este usuário.");
      return;
    }

    console.log(`Empresa encontrada: ${company.name} (${company.id})`);

    const [customization] = await db
      .select()
      .from(schema.companySiteCustomizations)
      .where(eq(schema.companySiteCustomizations.companyId, company.id));

    if (!customization) {
      console.log("Customização não encontrada.");
      return;
    }

    console.log("\n--- Dados de Customização (Home) ---");
    console.log(JSON.stringify(customization.home, null, 2));

  } catch (error) {
    console.error("Erro ao verificar dados:", error);
  } finally {
    process.exit();
  }
}

checkAuraCustomization();
