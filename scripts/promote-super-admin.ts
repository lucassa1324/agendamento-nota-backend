import { db } from "../src/modules/infrastructure/drizzle/database";
import * as schema from "../src/db/schema";
import { eq } from "drizzle-orm";

async function promoteToSuperAdmin(email: string) {
  const [usr] = await db
    .select()
    .from(schema.user)
    .where(eq(schema.user.email, email))
    .limit(1);

  if (!usr) {
    console.log(`❌ Usuário ${email} não encontrado.`);
    return;
  }

  await db
    .update(schema.user)
    .set({ 
      role: "SUPER_ADMIN",
      active: true 
    })
    .where(eq(schema.user.id, usr.id));

  console.log(`✅ Usuário ${email} promovido a SUPER_ADMIN com sucesso!`);
}

const email = process.argv[2];
if (!email) {
  console.log("Por favor, forneça o email do usuário.");
} else {
  promoteToSuperAdmin(email).catch(console.error);
}
