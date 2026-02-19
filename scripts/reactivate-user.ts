
import { db } from "../src/modules/infrastructure/drizzle/database";
import { companies } from "../src/db/schema";
import { eq } from "drizzle-orm";

async function run() {
  const slug = "studio-evellyn-barros";
  
  const newTrialDate = new Date();
  newTrialDate.setDate(newTrialDate.getDate() + 30); // +30 dias

  await db.update(companies)
    .set({ 
        subscriptionStatus: 'trial', 
        trialEndsAt: newTrialDate 
    })
    .where(eq(companies.slug, slug));

  console.log(`Company ${slug} reactivated until ${newTrialDate}`);
  process.exit(0);
}

run();
