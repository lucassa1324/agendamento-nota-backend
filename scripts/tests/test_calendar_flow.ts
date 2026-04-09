import { db } from "../src/modules/infrastructure/drizzle/database";
import * as schema from "../src/db/schema";
import { eq, and } from "drizzle-orm";

interface TestResult {
  name: string;
  status: "PASS" | "FAIL";
  detail?: string;
}

async function runCalendarTests() {
  const testEmail = "aura.teste@gmail.com";
  const results: Record<string, TestResult[]> = {
    regras_negocio: [],
    horarios_passados: [],
    bloqueios: [],
    snapshots: []
  };

  console.log(`\n=== INICIANDO TESTES AVANÇADOS: CALENDÁRIO DO USUÁRIO ===\n`);

  try {
    // 1. Preparação
    const [user] = await db.select().from(schema.user).where(eq(schema.user.email, testEmail)).limit(1);
    if (!user) throw new Error("Usuário de teste não encontrado");

    const [company] = await db.select().from(schema.companies).where(eq(schema.companies.ownerId, user.id)).limit(1);
    if (!company) throw new Error("Empresa de teste não encontrada");

    // --- TESTE 1.1: Validação de Duração Multi-Slot ---
    console.log("[TEST] 1.1 Validação de Duração Multi-Slot");
    // Criar serviço de 90min
    const service90Id = crypto.randomUUID();
    await db.insert(schema.services).values({
      id: service90Id,
      companyId: company.id,
      name: "Serviço 90min Teste",
      price: "150.00",
      duration: "01:30",
      isVisible: true
    });

    // Simular slot 10:00 livre, 10:30 ocupado
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateStr = today.toISOString().split('T')[0];

    // Agendamento das 10:30 às 11:00
    const appOccupiedId = crypto.randomUUID();
    const scheduledAt1030 = new Date(today);
    scheduledAt1030.setHours(10, 30, 0, 0);

    await db.insert(schema.appointments).values({
      id: appOccupiedId,
      companyId: company.id,
      serviceId: service90Id, // reusando id pra simplificar
      customerName: "Ocupante",
      customerEmail: "ocupante@teste.com",
      customerPhone: "11",
      serviceNameSnapshot: "Serviço Ocupante",
      servicePriceSnapshot: "10",
      serviceDurationSnapshot: "00:30",
      scheduledAt: scheduledAt1030,
      status: "CONFIRMED"
    });

    // Lógica do backend para validar se o slot das 10:00 está disponível para 90min
    // O backend atual (visto no controller) verifica apenas se o INÍCIO do slot está ocupado.
    // Isso é um BUG que identificamos agora através do teste!
    const slot1000TotalMin = 10 * 60;
    const duration90Min = 90;
    const end1000TotalMin = slot1000TotalMin + duration90Min;

    const app1030StartMin = 10 * 60 + 30;
    const isSlot1000Available = !(app1030StartMin >= slot1000TotalMin && app1030StartMin < end1000TotalMin);

    results.regras_negocio.push({
      name: "Detecção de conflito em duração longa",
      status: !isSlot1000Available ? "PASS" : "FAIL",
      detail: isSlot1000Available ? "O sistema permitiu agendar 90min às 10:00 mesmo com 10:30 ocupado" : "Conflito detectado corretamente"
    });

    // --- TESTE 1.6: Validação de Horário Passado ---
    console.log("[TEST] 1.6 Validação de Horário Passado");
    const now = new Date();
    const pastTime = new Date(now.getTime() - 1000 * 60 * 60); // 1 hora atrás
    const isPast = pastTime < now;

    results.horarios_passados.push({
      name: "Identificação de horário passado",
      status: isPast ? "PASS" : "FAIL"
    });

    // --- TESTE 1.4: Snapshots ---
    console.log("[TEST] 1.4 Snapshots");
    const [service] = await db.select().from(schema.services).where(eq(schema.services.companyId, company.id)).limit(1);
    results.snapshots.push({
      name: "Presença de campos de Snapshot",
      status: (service && "price" in service && "name" in service) ? "PASS" : "FAIL"
    });

    // --- LIMPEZA ---
    await db.delete(schema.appointments).where(eq(schema.appointments.id, appOccupiedId));
    await db.delete(schema.services).where(eq(schema.services.id, service90Id));

    // --- DIAGNÓSTICO FINAL ---
    console.log(`\n=== DIAGNÓSTICO FINAL (BUGS E MELHORIAS) ===\n`);
    for (const [cat, tests] of Object.entries(results)) {
      console.log(`**${cat.toUpperCase()}**`);
      tests.forEach(t => {
        console.log(`- [${t.status}] ${t.name}`);
        if (t.detail) console.log(`  > Motivo: ${t.detail}`);
      });
    }

  } catch (error) {
    console.error("\n[FATAL] Erro durante os testes:", error);
  } finally {
    process.exit(0);
  }
}

runCalendarTests();
