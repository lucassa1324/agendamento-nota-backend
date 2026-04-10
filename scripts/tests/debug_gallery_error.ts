
import { db } from "../src/modules/infrastructure/drizzle/database";
import * as schema from "../src/db/schema";
import { eq } from "drizzle-orm";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(__dirname, "../.env.local") });

async function checkBusiness() {
  try {
    const businessId = "1ed46dfd-6258-4b22-9c2b-ba04f1b82602";
    console.log(`Verificando empresa com ID: ${businessId}`);

    const [business] = await db
      .select()
      .from(schema.companies)
      .where(eq(schema.companies.id, businessId));

    if (business) {
      console.log(`✅ Empresa encontrada: ${business.name}`);

      const images = await db
        .select()
        .from(schema.galleryImages)
        .where(eq(schema.galleryImages.businessId, businessId));

      console.log(`Total de imagens na galeria: ${images.length}`);
    } else {
      console.log(`❌ Empresa NÃO encontrada no banco de dados.`);
    }

  } catch (error: any) {
    console.error("Erro ao conectar no banco:", error.message);
  } finally {
    process.exit();
  }
}

checkBusiness();
