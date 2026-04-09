
import { GetSiteCustomizationUseCase } from "../../src/modules/settings/application/use-cases/get-site-customization.use-case";
import { DrizzleSettingsRepository } from "../../src/modules/settings/adapters/out/drizzle/settings.drizzle.repository";
import { db } from "../../src/modules/infrastructure/drizzle/database";
import { companies } from "../../src/db/schema";
import { eq } from "drizzle-orm";

async function testConsolidation() {
  const repository = new DrizzleSettingsRepository();
  const useCase = new GetSiteCustomizationUseCase(repository);

  const slug = "aura-teste";
  console.log(`>>> TESTANDO CONSOLIDAÇÃO PARA: ${slug}`);

  const [company] = await db
    .select()
    .from(companies)
    .where(eq(companies.slug, slug))
    .limit(1);

  if (!company) {
    console.error("Empresa não encontrada");
    return;
  }

  // Testar rascunho (onde as mudanças geralmente estão antes de publicar)
  const result = await useCase.execute(company.id);

  console.log("\n>>> RESULTADO CONSOLIDADO (O que o Front recebe):");
  console.log("Layout Global -> siteColors:");
  console.log(JSON.stringify(result.layoutGlobal?.siteColors, null, 2));
  console.log("\nAppointment Flow -> colors:");
  console.log(JSON.stringify(result.appointmentFlow?.colors, null, 2));
  console.log("\nAppointment Flow -> step1Services:");
  console.log(JSON.stringify(result.appointmentFlow?.step1Services, null, 2));

  if (result.appointmentFlow?.step1Services?.cardConfig?.backgroundColor) {
    console.log(`\nCOR FINAL DO CARD: ${result.appointmentFlow.step1Services.cardConfig.backgroundColor}`);
  } else {
    console.log("\nNENHUMA COR ENCONTRADA!");
  }
}

testConsolidation().catch(console.error);
