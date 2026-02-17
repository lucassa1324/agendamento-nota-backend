import { IAppointmentRepository } from "../../domain/ports/appointment.repository";
import { AppointmentStatus, Appointment } from "../../domain/entities/appointment.entity";
import { IBusinessRepository } from "../../../business/domain/ports/business.repository";
import { UserRepository } from "../../../user/adapters/out/user.repository";
import { IPushSubscriptionRepository } from "../../../notifications/domain/ports/push-subscription.repository";
import { NotificationService } from "../../../notifications/application/notification.service";
import { db } from "../../../infrastructure/drizzle/database";
import { appointments, serviceResources, inventory, inventoryLogs } from "../../../../db/schema";
import { eq, sql, inArray } from "drizzle-orm";

export class UpdateAppointmentStatusUseCase {
  constructor(
    private appointmentRepository: IAppointmentRepository,
    private businessRepository: IBusinessRepository,
    private userRepository: UserRepository,
    private pushSubscriptionRepository: IPushSubscriptionRepository
  ) { }

  private extractServiceIds(appointment: Appointment): string[] {
    let ids: string[] = [];
    let foundInNotes = false;

    // Tenta extrair IDs das notas (Fonte da Verdade para Multi-Serviços)
    // Formato esperado: "... | IDs: id1,id2,id3" ou "IDs: id1,id2,id3"
    if (appointment.notes) {
      const match = appointment.notes.match(/IDs:\s*([\w\s,-]+)/);
      if (match && match[1]) {
        const extractedIds = match[1].split(',').map(id => id.trim());
        const validIds: string[] = [];
        extractedIds.forEach(id => {
          if (id) validIds.push(id);
        });

        if (validIds.length > 0) {
          ids = validIds;
          foundInNotes = true;
        }
      }
    }

    // Se NÃO encontrou nada nas notas, usa o ID principal
    // (Se encontrou nas notas, ignoramos o serviceId principal para evitar duplicação, 
    // assumindo que a lista das notas já inclui o principal quando ela existe)
    if (!foundInNotes && appointment.serviceId) {
      ids.push(appointment.serviceId);
    }

    return ids;
  }

  async execute(id: string, status: AppointmentStatus, userId: string) {
    const appointment = await this.appointmentRepository.findById(id);

    if (!appointment) {
      throw new Error("Appointment not found");
    }

    // Verifica se o usuário é o dono da empresa do agendamento
    const business = await this.businessRepository.findById(appointment.companyId);

    if (!business || business.ownerId !== userId) {
      throw new Error("Unauthorized to update this appointment status");
    }

    const updatedAppointment = await db.transaction(async (tx) => {
      // Trava de Segurança: Buscar status atual dentro da transação para evitar estorno duplo (race condition)
      const [currentAppointment] = await tx
        .select({ status: appointments.status })
        .from(appointments)
        .where(eq(appointments.id, id));

      if (!currentAppointment) {
        throw new Error("Appointment not found in transaction");
      }

      // Extrair IDs de todos os serviços (Multi-Serviço)
      const serviceIds = this.extractServiceIds(appointment);

      // 1. Reversão de estoque (COMPLETED -> OUTRO)
      if (currentAppointment.status === "COMPLETED" && status !== "COMPLETED") {

        console.log("\n--- 🔍 [INÍCIO AUDITORIA ESTORNO] ---");
        console.log(`ID Agendamento: ${id}`);

        // BUSCA TODOS OS LOGS (Entrada e Saída) para calcular o saldo real
        const allLogs = await tx
          .select({
            log: inventoryLogs,
            product: inventory
          })
          .from(inventoryLogs)
          .innerJoin(inventory, eq(inventoryLogs.inventoryId, inventory.id))
          .where(
            sql`(${inventoryLogs.reason} LIKE ${`%Agendamento #${id} concluído%`} AND ${inventoryLogs.type} = 'EXIT')
             OR (${inventoryLogs.reason} LIKE ${`%Agendamento #${id} revertido%`} AND ${inventoryLogs.type} = 'ENTRY')`
          );

        console.log(`Total de logs encontrados: ${allLogs.length}`);

        if (allLogs.length > 0) {
          // Agrupar por InventoryID para calcular o saldo (Saídas - Entradas)
          const balanceMap = new Map<string, { product: typeof inventory.$inferSelect, balance: number }>();

          for (const { log, product } of allLogs) {
            const current = balanceMap.get(log.inventoryId) || { product, balance: 0 };
            const logQty = Number(log.quantity);

            if (log.type === 'EXIT') {
              current.balance += logQty; // O quanto saiu
            } else if (log.type === 'ENTRY') {
              current.balance -= logQty; // O quanto já voltou
            }

            balanceMap.set(log.inventoryId, current);
          }

          for (const [inventoryId, { product, balance }] of balanceMap.entries()) {
            // Pequena tolerância para float
            if (balance > 0.0001) {
              const quantityToRevert = Number(balance.toFixed(2)); // Arredondamento seguro

              console.log(`[EXECUTANDO ESTORNO] Item: ${product.name} | Saldo a devolver: ${quantityToRevert}`);

              // Incrementar estoque
              await tx
                .update(inventory)
                .set({
                  currentQuantity: sql`${inventory.currentQuantity} + ${quantityToRevert.toFixed(2)}`,
                  updatedAt: new Date(),
                })
                .where(eq(inventory.id, inventoryId));

              // Log de Entrada (Reversão)
              await tx.insert(inventoryLogs).values({
                id: crypto.randomUUID(),
                inventoryId: inventoryId,
                companyId: appointment.companyId,
                type: "ENTRY",
                quantity: quantityToRevert.toFixed(2),
                reason: `Estorno automático: Agendamento #${id} revertido (Saldo Pendente)`,
                createdAt: new Date(),
              });
            } else {
              console.log(`[SKIP] Item: ${product.name} | Saldo já está zerado ou negativo (${balance}).`);
            }
          }
        } else {
          // FALLBACK: Se não houver logs (dados legados), recalcular com base nas configurações atuais
          // Nota: Isso só deve acontecer para agendamentos MUITO antigos sem logs.
          console.log("⚠️ ATENÇÃO: Nenhum log encontrado. O sistema vai cair no Fallback.");

          // ... (Mantendo a lógica de fallback original para segurança, caso não ache logs)
          // Mas com verificação extra de idempotência simples
          const existingLog = await tx
            .select()
            .from(inventoryLogs)
            .where(sql`${inventoryLogs.reason} LIKE ${`%Agendamento #${id} revertido%`}`)
            .limit(1);

          if (existingLog.length > 0) {
            console.log("[FALLBACK SKIP] Já existe estorno para este agendamento legado.");
          } else {
            // ... (Lógica de fallback original) ...
            const resources = await tx
              .select({
                resource: serviceResources,
                product: inventory
              })
              .from(serviceResources)
              .innerJoin(inventory, eq(serviceResources.inventoryId, inventory.id))
              .where(inArray(serviceResources.serviceId, serviceIds));

            const uniqueSharedResources = new Map<string, { resource: typeof serviceResources.$inferSelect, product: typeof inventory.$inferSelect }>();
            const nonSharedResources: { resource: typeof serviceResources.$inferSelect, product: typeof inventory.$inferSelect }[] = [];

            for (const item of resources) {
              const isShared = item.product.isShared === true || (item.product.isShared as any) === 'true';
              if (isShared) {
                const existing = uniqueSharedResources.get(item.resource.inventoryId);
                if (!existing || Number(item.resource.quantity) > Number(existing.resource.quantity)) {
                  uniqueSharedResources.set(item.resource.inventoryId, item);
                }
              } else {
                nonSharedResources.push(item);
              }
            }

            const itemsToRevert = [...Array.from(uniqueSharedResources.values()), ...nonSharedResources];

            for (const { resource, product } of itemsToRevert) {
              let quantityToRevert = Number(resource.quantity);
              const conversionFactor = Number(product.conversionFactor) || 1;

              if (product.secondaryUnit && resource.unit === product.secondaryUnit && conversionFactor > 0) {
                quantityToRevert = quantityToRevert / conversionFactor;
              }

              await tx
                .update(inventory)
                .set({
                  currentQuantity: sql`${inventory.currentQuantity} + ${quantityToRevert.toFixed(2)}`,
                  updatedAt: new Date(),
                })
                .where(eq(inventory.id, resource.inventoryId));

              await tx.insert(inventoryLogs).values({
                id: crypto.randomUUID(),
                inventoryId: resource.inventoryId,
                companyId: appointment.companyId,
                type: "ENTRY",
                quantity: quantityToRevert.toFixed(2),
                reason: `Estorno automático: Agendamento #${id} revertido (Fallback)`,
                createdAt: new Date(),
              });
            }
          }
        }
        console.log("--- ✅ [FIM AUDITORIA ESTORNO] ---\n");
      }

      // 2. Consumo de estoque (OUTRO -> COMPLETED)
      if (currentAppointment.status !== "COMPLETED" && status === "COMPLETED") {

        // NÃO DELETAMOS MAIS OS LOGS AQUI para manter o histórico e permitir o cálculo de saldo.
        // A lógica de estorno agora vai usar o saldo real (Saídas - Entradas).

        const resources = await tx
          .select({
            resource: serviceResources,
            product: inventory
          })
          .from(serviceResources)
          .innerJoin(inventory, eq(serviceResources.inventoryId, inventory.id))
          .where(inArray(serviceResources.serviceId, serviceIds));

        // Lógica Híbrida: Deduplicação (Shared - Primeiro Item) vs Soma Bruta (Non-Shared)
        let itemsToConsume: { resource: typeof serviceResources.$inferSelect, product: typeof inventory.$inferSelect }[] = [];
        const processedSharedItems = new Set<string>();

        // 1. Agrupar recursos por Service ID para garantir processamento na ordem correta
        const resourcesByService = new Map<string, { resource: typeof serviceResources.$inferSelect, product: typeof inventory.$inferSelect }[]>();

        for (const item of resources) {
          const sId = item.resource.serviceId;
          if (!resourcesByService.has(sId)) {
            resourcesByService.set(sId, []);
          }
          resourcesByService.get(sId)?.push(item);
        }

        // 2. Iterar sobre os serviços NA ORDEM DO AGENDAMENTO (serviceIds extraídos anteriormente)
        for (const sId of serviceIds) {
          const serviceResourcesList = resourcesByService.get(sId) || [];

          for (const item of serviceResourcesList) {
            // Robustez: Garantir que isShared seja tratado corretamente
            const isShared = item.product.isShared === true || (item.product.isShared as any) === 'true';

            if (isShared) {
              // Deduplicação: Contabiliza apenas a primeira ocorrência (regra "Primeiro Item")
              if (!processedSharedItems.has(item.resource.inventoryId)) {
                itemsToConsume.push(item);
                processedSharedItems.add(item.resource.inventoryId);
              }
              // Se já foi processado neste agendamento, ignora (não consome novamente)
            } else {
              // Soma Bruta: Adiciona à lista normalmente (não compartilhado)
              itemsToConsume.push(item);
            }
          }
        }

        const notifiedLowStock = new Set<string>();

        for (const { resource, product } of itemsToConsume) {
          let quantityToConsume = Number(resource.quantity);
          const conversionFactor = Number(product.conversionFactor) || 1;

          if (product.secondaryUnit && resource.unit === product.secondaryUnit && conversionFactor > 0) {
            quantityToConsume = quantityToConsume / conversionFactor;
          }

          // Decrementar estoque
          await tx
            .update(inventory)
            .set({
              currentQuantity: sql`${inventory.currentQuantity} - ${quantityToConsume.toFixed(2)}`, // Arredondamento
              updatedAt: new Date(),
            })
            .where(eq(inventory.id, resource.inventoryId));

          // Log de Saída
          await tx.insert(inventoryLogs).values({
            id: crypto.randomUUID(),
            inventoryId: resource.inventoryId,
            companyId: appointment.companyId,
            type: "EXIT",
            quantity: quantityToConsume.toFixed(2), // Arredondamento
            reason: `Consumo automático: Agendamento #${id} concluído | Modo: ${product.isShared ? 'Deduplicado (Shared)' : 'Bruto'}`,
            createdAt: new Date(),
          });

          const currentQty = Number(product.currentQuantity);
          const newQty = Number((currentQty - quantityToConsume).toFixed(2)); // Arredondamento
          const minQty = Number(product.minQuantity);

          // CORREÇÃO: Comparar sempre na Unidade Secundária (Ex: Unidades, não Caixas)
          let comparisonQty = newQty;
          let comparisonMin = minQty;

          if (product.conversionFactor && product.secondaryUnit) {
            const factor = Number(product.conversionFactor);
            if (!isNaN(factor) && factor > 0) {
              // Converte o SALDO ATUAL para Unidades (Ex: 0.18 cx -> 18 un)
              comparisonQty = Number((newQty * factor).toFixed(2));

              // CORREÇÃO: Não converter o Limite Mínimo.
              // Assumimos que, se o produto tem unidade secundária, o usuário configurou o alerta pensando nela.
              // Ex: Configurar "10" significa "10 Unidades", não "10 Caixas".
              comparisonMin = minQty;
            }
          }

          console.log(`Testando alerta: Saldo atual ${newQty} ${product.unit} -> ${comparisonQty} ${product.secondaryUnit || product.unit} | Limite (Config) ${minQty} ${product.unit} -> ${comparisonMin} ${product.secondaryUnit || product.unit}`);

          if (comparisonQty <= comparisonMin && !notifiedLowStock.has(product.id)) {
            try {
              const owner = await this.userRepository.find(business.ownerId);
              if (owner && owner.notifyInventoryAlerts) {
                const notificationService = new NotificationService(this.pushSubscriptionRepository);

                let displayQty = comparisonQty;
                let displayUnit = product.secondaryUnit || product.unit;

                await notificationService.sendToUser(
                  business.ownerId,
                  "📦 Estoque Baixo!",
                  `O produto ${product.name} atingiu o nível crítico (${displayQty} ${displayUnit}).`
                );
                notifiedLowStock.add(product.id);
              }
            } catch (err) {
              console.error("[INVENTORY_ALERT] Error sending notification:", err);
            }
          }
        }
      }

      // 3. Atualizar status do agendamento
      const [updated] = await tx
        .update(appointments)
        .set({ status, updatedAt: new Date() })
        .where(eq(appointments.id, id))
        .returning();

      return updated as Appointment;
    });

    // Notificação de Cancelamento
    if (status === "CANCELLED") {
      try {
        const ownerId = business.ownerId;
        const owner = await this.userRepository.find(ownerId);

        if (owner && owner.notifyCancellations) {
          const notificationService = new NotificationService(this.pushSubscriptionRepository);

          await notificationService.sendToUser(
            ownerId,
            "❌ Agendamento Cancelado",
            `${appointment.customerName} cancelou o serviço ${appointment.serviceNameSnapshot} previsto para ${appointment.scheduledAt.toLocaleString("pt-BR")}.`
          );
        }
      } catch (err) {
        console.error("[CANCEL_NOTIFICATION_ERROR]", err);
      }
    }

    return updatedAppointment;
  }
}
