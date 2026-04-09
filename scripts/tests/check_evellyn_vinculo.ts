
import { db } from "../src/modules/infrastructure/drizzle/database";
import * as schema from "../src/db/schema";
import { eq } from "drizzle-orm";

async function checkEvellynVinculo() {
  console.log("--- Verificando Vínculo da Evellyn ---");
  const email = "evellyn@gmail.com";
  
  const userResults = await db.select().from(schema.user).where(eq(schema.user.email, email));
  
  if (userResults.length === 0) {
    console.log("Usuário não encontrado.");
    return;
  }
  
  const user = userResults[0];
  console.log("Usuário:", JSON.stringify(user, null, 2));
  
  const companyResults = await db.select().from(schema.companies).where(eq(schema.companies.ownerId, user.id));
  
  if (companyResults.length === 0) {
    console.log("\nNenhuma empresa encontrada onde este usuário é owner.");
  } else {
    console.log("\nEmpresas vinculadas (como owner):", JSON.stringify(companyResults, null, 2));
  }
}

checkEvellynVinculo().catch(console.error);
