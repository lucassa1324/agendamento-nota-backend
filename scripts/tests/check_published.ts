
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

async function checkPublished() {
  const queryClient = postgres(dbUrl as string, { prepare: false });
  const db = drizzle(queryClient);
  const businessId = "1ed46dfd-6258-4b22-9c2b-ba04f1b82602";

  try {
    console.log(`--- VERIFICANDO TABELA DE PUBLICADOS PARA ${businessId} ---`);
    const [published] = await db
      .select()
      .from(schema.companySiteCustomizations)
      .where(eq(schema.companySiteCustomizations.companyId, businessId));

    if (published) {
      console.log("✅ Registro Publicado encontrado!");
      const data = {
        layoutGlobal: published.layoutGlobal,
        home: published.home,
        gallery: published.gallery,
        aboutUs: published.aboutUs,
        appointmentFlow: published.appointmentFlow
      };
      console.log(JSON.stringify(data, null, 2));

      // Verificação específica da chave primaryButtonColor
      const hasPrimaryButtonColor = "primaryButtonColor" in (published as any);
      console.log(`\n>>> A chave 'primaryButtonColor' existe na RAIZ? ${hasPrimaryButtonColor}`);

      // Verificação dentro do layoutGlobal
      const layoutGlobal = published.layoutGlobal as any;
      console.log(`>>> A chave 'primaryButtonColor' existe dentro de layoutGlobal? ${!!layoutGlobal?.primaryButtonColor}`);
      if (layoutGlobal?.primaryButtonColor) {
        console.log(`>>> Valor em layoutGlobal: ${layoutGlobal.primaryButtonColor}`);
      }

    } else {
      console.log("ℹ️ Nenhum registro publicado encontrado para esta empresa.");
    }

  } catch (error: any) {
    console.error("❌ Erro ao verificar publicados:", error.message);
  } finally {
    await queryClient.end();
    process.exit();
  }
}

checkPublished();
