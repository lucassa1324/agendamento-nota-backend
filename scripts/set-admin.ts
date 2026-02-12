import { db } from "../src/modules/infrastructure/drizzle/database";
import * as schema from "../src/db/schema";
import { eq } from "drizzle-orm";

async function setSuperAdmin(email: string) {
  try {
    const [updated] = await db
      .update(schema.user)
      .set({ role: "SUPER_ADMIN" })
      .where(eq(schema.user.email, email))
      .returning();

    if (updated) {
      console.log(`✅ Usuário ${email} agora é SUPER_ADMIN.`);
    } else {
      console.log(`❌ Usuário com email ${email} não encontrado.`);
    }
  } catch (error) {
    console.error("❌ Erro ao atualizar role:", error);
  } finally {
    process.exit();
  }
}

const email = process.argv[2];
if (!email) {
  console.log("Uso: bun scripts/set-admin.ts <email>");
  process.exit(1);
}

setSuperAdmin(email);
