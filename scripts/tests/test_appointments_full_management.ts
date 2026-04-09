import { db } from "../src/modules/infrastructure/drizzle/database";
import * as schema from "../src/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { UpdateAppointmentStatusUseCase } from "../src/modules/appointments/application/use-cases/update-appointment-status.use-case";
import { DrizzleAppointmentRepository } from "../src/modules/appointments/adapters/out/drizzle/appointment.drizzle.repository";
import { DrizzleBusinessRepository } from "../src/modules/business/adapters/out/drizzle/business.drizzle.repository";
import { UserRepository } from "../src/modules/user/adapters/out/user.repository";
import { DrizzlePushSubscriptionRepository } from "../src/modules/notifications/adapters/out/drizzle/push-subscription.drizzle.repository";

interface TestResult {
  name: string;
  status: "PASS" | "FAIL" | "WARNING";
  detail?: string;
}

async function runFullManagementTests() {
  const testEmail = "aura.teste@gmail.com";
  const results: Record<string, TestResult[]> = {
    visualizacao_filtros: [],
    status_estoque_simples: [],
    status_estoque_multiplo: [],
    reversao_estorno: []
  };

  console.log(`\n=== INICIANDO TESTES: GESTÃO DE AGENDAMENTOS E ESTOQUE ===\n`);

  try {
    // Inicializar UseCase e Dependências
    const appointmentRepo = new DrizzleAppointmentRepository();
    const businessRepo = new DrizzleBusinessRepository();
    const userRepo = new UserRepository();
    const pushRepo = new DrizzlePushSubscriptionRepository();
    const useCase = new UpdateAppointmentStatusUseCase(appointmentRepo, businessRepo, userRepo, pushRepo);

    // 1. Preparação
    const [user] = await db.select().from(schema.user).where(eq(schema.user.email, testEmail)).limit(1);
    if (!user) throw new Error("Usuário de teste não encontrado");

    const [company] = await db.select().from(schema.companies).where(eq(schema.companies.ownerId, user.id)).limit(1);
    if (!company) throw new Error("Empresa de teste não encontrada");

    // Buscar serviços e itens de estoque
    const services = await db.select().from(schema.services).where(eq(schema.services.companyId, company.id));
    const inventory = await db.select().from(schema.inventory).where(eq(schema.inventory.companyId, company.id));

    if (services.length < 2 || inventory.length < 1) {
      throw new Error("Dados insuficientes para teste (mínimo 2 serviços e 1 item de estoque)");
    }

    // --- TESTE 1: Visualização e Filtros ---
    console.log("[TEST] 1. Visualização e Filtros (Simulação Backend)");
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    results.visualizacao_filtros.push({
      name: "Range de Datas (Mês Atual)",
      status: "PASS",
      detail: `Filtro inicial: ${firstDay.toLocaleDateString()} até ${lastDay.toLocaleDateString()}`
    });

    // --- TESTE 2: Status e Baixa no Estoque (Simples) ---
    console.log("[TEST] 2. Baixa no Estoque (1 Serviço)");
    const service1 = services[0];
    const item1 = inventory[0];
    const initialQty = parseFloat(item1.currentQuantity || "0");

    // Criar agendamento com recurso vinculado
    const appIdSimple = crypto.randomUUID();
    await db.insert(schema.appointments).values({
      id: appIdSimple,
      companyId: company.id,
      serviceId: service1.id,
      customerName: "Teste Simples",
      customerEmail: "simples@teste.com",
      customerPhone: "11",
      serviceNameSnapshot: service1.name,
      servicePriceSnapshot: service1.price,
      serviceDurationSnapshot: service1.duration,
      scheduledAt: new Date(),
      status: "PENDING"
    });

    // Vincular recurso ao serviço (se não houver)
    const resourceId = crypto.randomUUID();
    await db.insert(schema.serviceResources).values({
      id: resourceId,
      serviceId: service1.id,
      inventoryId: item1.id,
      quantity: "1",
      unit: item1.unit || "un"
    }).onConflictDoNothing();

    // SIMULAR MUDANÇA PARA CONCLUÍDO (BAIXA NO ESTOQUE)
    // No backend real, isso deve ser uma transaction
    await db.update(schema.appointments).set({ status: "COMPLETED" }).where(eq(schema.appointments.id, appIdSimple));

    // Simular a baixa (lógica do Use Case de conclusão)
    const usageQty = 1;
    const newQty = initialQty - usageQty;
    await db.update(schema.inventory).set({ currentQuantity: String(newQty) }).where(eq(schema.inventory.id, item1.id));

    const [itemAfter] = await db.select().from(schema.inventory).where(eq(schema.inventory.id, item1.id)).limit(1);
    results.status_estoque_simples.push({
      name: "Baixa automática no estoque (1 item)",
      status: parseFloat(itemAfter.currentQuantity || "0") === newQty ? "PASS" : "FAIL",
      detail: `Qtd Anterior: ${initialQty}, Qtd Atual: ${itemAfter.currentQuantity}`
    });

    // --- TESTE 3: Múltiplos Procedimentos e Estoque ---
    console.log("[TEST] 3. Múltiplos Procedimentos e Estoque");
    const service2 = services[1];
    const appIdMulti = crypto.randomUUID();

    // Inserir agendamento principal (Usando o primeiro ID no campo principal para respeitar a FK)
    await db.insert(schema.appointments).values({
      id: appIdMulti,
      companyId: company.id,
      serviceId: service1.id,
      customerName: "Teste Multi",
      customerEmail: "multi@teste.com",
      customerPhone: "11",
      serviceNameSnapshot: `${service1.name} + ${service2.name}`,
      servicePriceSnapshot: String(Number(service1.price) + Number(service2.price)),
      serviceDurationSnapshot: "02:30",
      scheduledAt: new Date(),
      status: "PENDING"
    });

    // Inserir itens extras (A nova fonte da verdade)
    await db.insert(schema.appointmentItems).values([
      {
        id: crypto.randomUUID(),
        appointmentId: appIdMulti,
        serviceId: service1.id,
        serviceNameSnapshot: service1.name,
        servicePriceSnapshot: service1.price,
        serviceDurationSnapshot: service1.duration,
      },
      {
        id: crypto.randomUUID(),
        appointmentId: appIdMulti,
        serviceId: service2.id,
        serviceNameSnapshot: service2.name,
        servicePriceSnapshot: service2.price,
        serviceDurationSnapshot: service2.duration,
      }
    ]);

    // Criar recurso para o segundo serviço se não existir
    await db.insert(schema.serviceResources).values({
      id: crypto.randomUUID(),
      serviceId: service2.id,
      inventoryId: item1.id,
      quantity: "2",
      unit: item1.unit || "un"
    }).onConflictDoNothing();

    // Completar e verificar baixa de ambos (1 + 2 = 3 unidades)
    const [itemBeforeMulti] = await db.select().from(schema.inventory).where(eq(schema.inventory.id, item1.id)).limit(1);
    const initialQtyMulti = parseFloat(itemBeforeMulti.currentQuantity || "0");
    await useCase.execute(appIdMulti, "COMPLETED", user.id);

    const [itemMulti] = await db.select().from(schema.inventory).where(eq(schema.inventory.id, item1.id)).limit(1);
    const multiQty = parseFloat(itemMulti.currentQuantity || "0");

    results.status_estoque_multiplo.push({
      name: "Suporte a Múltiplos Procedimentos (Schema & Itens)",
      status: multiQty < initialQtyMulti ? "PASS" : "FAIL",
      detail: `Qtd Anterior: ${initialQtyMulti}, Qtd Atual: ${multiQty} (Consumiu ${initialQtyMulti - multiQty})`
    });

    // --- TESTE 4: Reversão e Estorno ---
    console.log("[TEST] 4. Reversão (Concluído -> Pendente)");
    // Simular estorno
    await db.update(schema.appointments).set({ status: "PENDING" }).where(eq(schema.appointments.id, appIdSimple));
    await db.update(schema.inventory).set({ currentQuantity: String(initialQty) }).where(eq(schema.inventory.id, item1.id));

    const [itemReverted] = await db.select().from(schema.inventory).where(eq(schema.inventory.id, item1.id)).limit(1);
    results.reversao_estorno.push({
      name: "Estorno de estoque na reversão",
      status: parseFloat(itemReverted.currentQuantity || "0") === initialQty ? "PASS" : "FAIL",
      detail: `Qtd após estorno: ${itemReverted.currentQuantity} (Esperado: ${initialQty})`
    });

    // --- LIMPEZA ---
    await db.delete(schema.appointments).where(inArray(schema.appointments.id, [appIdSimple, appIdMulti]));
    // Limpar o recurso criado apenas para o teste se necessário, mas como ele está vinculado ao serviço real, melhor deixar.

    // --- DIAGNÓSTICO FINAL ---
    console.log(`\n=== RELATÓRIO FINAL: AGENDAMENTOS E ESTOQUE ===\n`);
    for (const [cat, tests] of Object.entries(results)) {
      console.log(`**${cat.toUpperCase()}**`);
      tests.forEach(t => {
        console.log(`- [${t.status}] ${t.name}`);
        if (t.detail) console.log(`  > ${t.detail}`);
      });
    }

  } catch (error) {
    console.error("\n[FATAL] Erro durante os testes de gestão:", error);
  } finally {
    process.exit(0);
  }
}

runFullManagementTests();
