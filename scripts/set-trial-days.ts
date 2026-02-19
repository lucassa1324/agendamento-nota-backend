
import { db } from "../src/modules/infrastructure/drizzle/database";
import { companies } from "../src/db/schema";
import { eq } from "drizzle-orm";

async function run() {
  const slug = "studio-evellyn-barros";
  const days = -1; // Define para ONTEM (Expirado)
  
  const newTrialDate = new Date();
  newTrialDate.setDate(newTrialDate.getDate() + days);

  console.log(`Buscando empresa com slug: ${slug}...`);

  const [updated] = await db.update(companies)
    .set({ 
        subscriptionStatus: 'trial', 
        trialEndsAt: newTrialDate,
        updatedAt: new Date()
    })
    .where(eq(companies.slug, slug))
    .returning();

  if (updated) {
      console.log(`✅ Sucesso! Empresa: ${updated.name} (${updated.slug})`);
      console.log(`📅 Novo vencimento do teste: ${updated.trialEndsAt?.toLocaleString()}`);
      
      // Cálculo de verificação
      const now = new Date();
      const end = new Date(updated.trialEndsAt!);
      const diffTime = end.getTime() - now.getTime();
      const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      console.log(`🔢 Dias restantes calculados: ${daysLeft}`);
  } else {
      console.error(`❌ Empresa não encontrada: ${slug}`);
  }
  
  process.exit(0);
}

run();
