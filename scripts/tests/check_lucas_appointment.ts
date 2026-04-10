
import { db } from "../src/modules/infrastructure/drizzle/database";
import * as schema from "../src/db/schema";
import { eq, and, desc } from "drizzle-orm";

async function checkAppointmentAndInventory() {
  console.log("\n--- VERIFICANDO AGENDAMENTO DE 'LUCAS' ---");

  // 1. Buscar o agendamento mais recente do Lucas
  const appointments = await db.select()
    .from(schema.appointments)
    .where(eq(schema.appointments.customerName, "LUCAS ALVES DE SA"))
    .orderBy(desc(schema.appointments.createdAt))
    .limit(1);

  if (appointments.length === 0) {
    console.log("❌ Nenhum agendamento encontrado para 'LUCAS ALVES DE SA'");
    process.exit(0);
  }

  const app = appointments[0];
  console.log(`✅ Agendamento Encontrado: ID ${app.id}`);
  console.log(`   Status: ${app.status}`);
  console.log(`   Serviços: ${app.serviceNameSnapshot}`);

  // 2. Buscar os itens do agendamento (tabela appointment_items)
  const items = await db.select()
    .from(schema.appointmentItems)
    .where(eq(schema.appointmentItems.appointmentId, app.id));

  console.log(`   Itens vinculados: ${items.length}`);
  for (const item of items) {
    console.log(`     - Item: ${item.serviceNameSnapshot} (ID: ${item.serviceId})`);
  }

  // 3. Verificar o estoque dos produtos vinculados a esses serviços
  console.log("\n--- ESTOQUE ATUAL DOS PRODUTOS ---");

  const serviceIds = items.map(i => i.serviceId);
  if (serviceIds.length === 0 && app.serviceId) serviceIds.push(app.serviceId);

  // Remover duplicados
  const uniqueServiceIds = [...new Set(serviceIds)];

  for (const sId of uniqueServiceIds) {
    // Buscar recursos do serviço
    const resources = await db.select()
      .from(schema.serviceResources)
      .where(eq(schema.serviceResources.serviceId, sId));

    for (const res of resources) {
      const product = await db.select()
        .from(schema.inventory)
        .where(eq(schema.inventory.id, res.inventoryId))
        .limit(1);

      if (product.length > 0) {
        console.log(`📦 Produto: ${product[0].name}`);
        console.log(`   Quantidade em estoque: ${product[0].currentQuantity} ${product[0].unit}`);
        console.log(`   Uso por serviço: ${res.quantity} ${res.unit}`);
      }
    }
  }

  process.exit(0);
}

checkAppointmentAndInventory().catch(err => {
  console.error(err);
  process.exit(1);
});
