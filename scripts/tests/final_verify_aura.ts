
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/db/schema";
import { eq } from "drizzle-orm";

const dbUrl = "postgresql://neondb_owner:npg_Mmy0tQl2CTKS@ep-steep-base-a4rcsq71-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

async function verifyAura() {
  const queryClient = postgres(dbUrl, { prepare: false });
  const db = drizzle(queryClient);

  try {
    console.log("Conectando ao Neon DB para verificar aura.teste@gmail.com...");

    const [user] = await db
      .select()
      .from(schema.user)
      .where(eq(schema.user.email, "aura.teste@gmail.com"));

    if (!user) {
      console.log("❌ Usuário não encontrado no banco.");
      return;
    }

    console.log(`✅ Usuário encontrado: ${user.id}`);

    const [company] = await db
      .select()
      .from(schema.companies)
      .where(eq(schema.companies.ownerId, user.id));

    if (!company) {
      console.log("❌ Empresa não encontrada.");
      return;
    }

    console.log(`✅ Empresa encontrada: ${company.name} (${company.id})`);

    const [customization] = await db
      .select()
      .from(schema.companySiteCustomizations)
      .where(eq(schema.companySiteCustomizations.companyId, company.id));

    if (!customization) {
      console.log("❌ Customização não encontrada no banco.");
      return;
    }

    console.log("\n--- DADOS PERSISTIDOS NO BANCO (COMPLETO) ---");
    console.log(JSON.stringify(customization, null, 2));

  } catch (error: any) {
    console.error("Erro na verificação:", error.message);
  } finally {
    await queryClient.end();
    process.exit();
  }
}

verifyAura();
