
import { db } from "../src/modules/infrastructure/drizzle/database";
import * as schema from "../src/db/schema";
import { eq } from "drizzle-orm";

async function checkUserAndBusiness() {
  const email = "atrossilva2019@gmail.com";
  console.log(`Checking user: ${email}`);

  const users = await db.select().from(schema.user).where(eq(schema.user.email, email)).limit(1);

  if (users.length === 0) {
    console.log("User not found");
    return;
  }

  const user = users[0];
  console.log("User details:", {
    id: user.id,
    email: user.email,
    cpfCnpj: user.cpfCnpj,
    role: user.role,
    active: user.active
  });

  const businesses = await db.select().from(schema.companies).where(eq(schema.companies.ownerId, user.id)).limit(1);

  if (businesses.length === 0) {
    console.log("No business found for this user");
    return;
  }

  const business = businesses[0];
  console.log("Business details:", {
    id: business.id,
    name: business.name,
    slug: business.slug,
    ownerId: business.ownerId,
    active: business.active,
    subscriptionStatus: business.subscriptionStatus
  });
}

checkUserAndBusiness().catch(console.error);
