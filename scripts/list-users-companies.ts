
import { db } from "../src/modules/infrastructure/drizzle/database";
import { user, companies } from "../src/db/schema";
import { eq } from "drizzle-orm";

async function list() {
  const users = await db.select().from(user);
  for (const u of users) {
    const comp = await db.select().from(companies).where(eq(companies.ownerId, u.id));
    console.log(`User: ${u.email} (${u.name}) - Role: ${u.role}`);
    for (const c of comp) {
      console.log(`  Company: ${c.name} (${c.slug}) - Status: ${c.subscriptionStatus} - TrialEnds: ${c.trialEndsAt}`);
    }
  }
  process.exit(0);
}

list();
