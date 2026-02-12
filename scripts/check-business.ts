import { db } from "../src/modules/infrastructure/drizzle/database";
import * as schema from "../src/db/schema";
import { eq } from "drizzle-orm";

async function checkUserBusiness(email: string) {
  try {
    const users = await db.select().from(schema.user).where(eq(schema.user.email, email)).limit(1);
    if (users.length === 0) {
      console.log(`❌ Usuário ${email} não encontrado.`);
      return;
    }
    const user = users[0];
    const userCompanies = await db.select().from(schema.companies).where(eq(schema.companies.ownerId, user.id));
    
    if (userCompanies.length === 0) {
      console.log(`❌ Nenhuma empresa encontrada para o usuário ${email} (ID: ${user.id}).`);
    } else {
      console.log(`✅ Empresa(s) encontrada(s) para ${email}:`);
      userCompanies.forEach(c => {
        console.log(`- ID: ${c.id}`);
        console.log(`  Nome: ${c.name}`);
        console.log(`  Slug: ${c.slug}`);
        console.log(`  Ativo: ${c.active}`);
      });
    }
  } catch (error) {
    console.error("❌ Erro ao verificar empresa:", error);
  } finally {
    process.exit();
  }
}

const email = process.argv[2];
if (!email) {
  console.log("Uso: bun scripts/check-business.ts <email>");
  process.exit(1);
}
checkUserBusiness(email);
