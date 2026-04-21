
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./src/db/schema";
import { eq } from "drizzle-orm";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(__dirname, ".env.local") });

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.error("DATABASE_URL não encontrado no .env.local");
  process.exit(1);
}

async function checkDrafts() {
  const queryClient = postgres(dbUrl as string, { prepare: false });
  const db = drizzle(queryClient);

  try {
    console.log("--- BUSCANDO USUÁRIO DE TESTE (aura.teste@gmail.com) ---");
    const [user] = await db
      .select()
      .from(schema.user)
      .where(eq(schema.user.email, "aura.teste@gmail.com"));

    if (!user) {
      console.log("❌ Usuário não encontrado.");
      return;
    }

    console.log(`✅ Usuário encontrado: ${user.id}`);

    const [company] = await db
      .select()
      .from(schema.companies)
      .where(eq(schema.companies.ownerId, user.id));

    if (!company) {
      console.log("❌ Empresa não encontrada para este usuário.");
      return;
    }

    console.log(`✅ Empresa encontrada: ${company.name} (${company.id})`);

    console.log("\n--- VERIFICANDO TABELA DE RASCUNHOS (site_drafts) ---");
    const [draft] = await db
      .select()
      .from(schema.siteDrafts)
      .where(eq(schema.siteDrafts.companyId, company.id));

    if (draft) {
      console.log("✅ Rascunho encontrado!");
      console.log(JSON.stringify(draft, null, 2));
    } else {
      console.log("ℹ️ Nenhum rascunho encontrado para esta empresa.");
    }

  } catch (error: any) {
    console.error("❌ Erro ao verificar rascunhos:", error.message);
  } finally {
    await queryClient.end();
    process.exit();
  }
}

checkDrafts();
