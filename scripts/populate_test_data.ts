import { db } from "../src/modules/infrastructure/drizzle/database";
import * as schema from "../src/db/schema";
import { eq } from "drizzle-orm";

async function populateTestData() {
  const testEmail = "aura.teste@gmail.com";

  console.log(`[POPULATE] Buscando empresa para o usuário: ${testEmail}`);

  try {
    // 1. Buscar o usuário e sua empresa
    const [user] = await db
      .select()
      .from(schema.user)
      .where(eq(schema.user.email, testEmail))
      .limit(1);

    if (!user) {
      console.error("[ERROR] Usuário de teste não encontrado!");
      return;
    }

    const [company] = await db
      .select()
      .from(schema.companies)
      .where(eq(schema.companies.ownerId, user.id))
      .limit(1);

    if (!company) {
      console.error("[ERROR] Empresa de teste não encontrada!");
      return;
    }

    console.log(`[POPULATE] Empresa encontrada: ${company.name} (${company.id})`);

    // 2. Cadastrar Itens no Estoque
    console.log("[POPULATE] Cadastrando itens no estoque...");
    const inventoryItems = [
      {
        name: "Shampoo Pós-Química 1L",
        initialQuantity: "10",
        currentQuantity: "8",
        minQuantity: "2",
        unitPrice: "85.50",
        unit: "L",
        secondaryUnit: "ml",
        conversionFactor: "1000",
      },
      {
        name: "Esmalte Vermelho Royal",
        initialQuantity: "20",
        currentQuantity: "15",
        minQuantity: "5",
        unitPrice: "12.00",
        unit: "un",
      },
      {
        name: "Cera Depilatória Mel 500g",
        initialQuantity: "15",
        currentQuantity: "12",
        minQuantity: "3",
        unitPrice: "45.00",
        unit: "g",
        conversionFactor: "1",
      },
      {
        name: "Toalhas Brancas Algodão",
        initialQuantity: "50",
        currentQuantity: "42",
        minQuantity: "10",
        unitPrice: "15.00",
        unit: "un",
      }
    ];

    const insertedInventory = [];
    for (const item of inventoryItems) {
      const [inserted] = await db.insert(schema.inventory).values({
        id: crypto.randomUUID(),
        companyId: company.id,
        ...item,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();
      insertedInventory.push(inserted);
      
      // Criar log de entrada inicial
      await db.insert(schema.inventoryLogs).values({
        id: crypto.randomUUID(),
        inventoryId: inserted.id,
        companyId: company.id,
        type: "ENTRY",
        quantity: item.initialQuantity,
        reason: "Carga inicial de teste",
        createdAt: new Date(),
      });
    }

    // 3. Cadastrar Serviços
    console.log("[POPULATE] Cadastrando serviços...");
    const services = [
      {
        name: "Corte de Cabelo Feminino",
        description: "Corte moderno com lavagem inclusa",
        price: "120.00",
        duration: "01:00",
        icon: "scissors",
        isVisible: true,
        showOnHome: true,
      },
      {
        name: "Manicure + Pedicure",
        description: "Cutilagem e esmaltação completa",
        price: "85.00",
        duration: "01:30",
        icon: "hand",
        isVisible: true,
        showOnHome: true,
      },
      {
        name: "Escova Modeladora",
        description: "Lavagem, secagem e modelagem dos fios",
        price: "60.00",
        duration: "00:45",
        icon: "wind",
        isVisible: true,
        showOnHome: false,
      }
    ];

    for (const service of services) {
      const [insertedService] = await db.insert(schema.services).values({
        id: crypto.randomUUID(),
        companyId: company.id,
        ...service,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();

      // Vincular recurso ao primeiro serviço (Corte) se for o caso
      if (service.name === "Corte de Cabelo Feminino") {
        const shampoo = insertedInventory.find(i => i.name.includes("Shampoo"));
        if (shampoo) {
          await db.insert(schema.serviceResources).values({
            id: crypto.randomUUID(),
            serviceId: insertedService.id,
            inventoryId: shampoo.id,
            quantity: "50", // 50ml
            unit: "ml",
            useSecondaryUnit: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
      }
    }

    console.log("-----------------------------------------");
    console.log("[SUCCESS] Dados de Teste Populados!");
    console.log(`Empresa: ${company.name}`);
    console.log(`Serviços criados: ${services.length}`);
    console.log(`Itens de estoque: ${inventoryItems.length}`);
    console.log("-----------------------------------------");

  } catch (error) {
    console.error("[FATAL] Erro ao popular dados:", error);
  } finally {
    process.exit(0);
  }
}

populateTestData();
