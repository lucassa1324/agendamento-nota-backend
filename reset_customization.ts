
import { db } from "./src/modules/infrastructure/drizzle/database";
import { companySiteCustomizations } from "./src/db/schema";
import { eq } from "drizzle-orm";

async function resetCustomization(businessId: string) {
  if (!businessId) {
    console.error("Please provide a businessId as an argument.");
    process.exit(1);
  }

  console.log(`Resetting customization for businessId: ${businessId}...`);
  
  const result = await db
    .delete(companySiteCustomizations)
    .where(eq(companySiteCustomizations.companyId, businessId))
    .returning();

  if (result.length > 0) {
    console.log(`Successfully deleted customization for businessId: ${businessId}`);
  } else {
    console.log(`No customization found for businessId: ${businessId}`);
  }
  
  process.exit(0);
}

const businessId = process.argv[2];
resetCustomization(businessId);
