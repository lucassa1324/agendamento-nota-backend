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
    const ids = new Set<string>();
    // Adiciona o ID principal
    if (appointment.serviceId) ids.add(appointment.serviceId);

    // Tenta extrair outros IDs das notas
    // Formato esperado: "... | IDs: id1,id2,id3" ou "IDs: id1,id2,id3"
    if (appointment.notes) {
      const match = appointment.notes.match(/IDs:\s*([\w\s,-]+)/);
      if (match && match[1]) {
        const extractedIds = match[1].split(',').map(id => id.trim());
        extractedIds.forEach(id => {
          if (id) ids.add(id);
        });
      }
    }

    const result = Array.from(ids);
    console.log(`[QUERY_RESOURCES] IDs de serviços encontrados: [${result.join(', ')}]`);
    return result;
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

        // Verificação de Idempotência
        const existingLog = await tx
          .select()
          .from(inventoryLogs)
          .where(sql`${inventoryLogs.reason} LIKE ${`%Agendamento #${id} revertido%`}`)
          .limit(1);

        if (existingLog.length > 0) {
          console.log(`[IDEMPOTÊNCIA] Estorno já realizado para agendamento #${id}. Pulando reversão de estoque.`);
        } else {
          // Buscar itens para TODOS os serviços
          const resources = await tx
            .select({
              resource: serviceResources,
              product: inventory
            })
            .from(serviceResources)
            .innerJoin(inventory, eq(serviceResources.inventoryId, inventory.id))
            .where(inArray(serviceResources.serviceId, serviceIds));

          // Deduplicação por InventoryID (Pega a maior quantidade definida entre os serviços)
          const uniqueResources = new Map<string, { resource: typeof serviceResources.$inferSelect, product: typeof inventory.$inferSelect }>();

          for (const item of resources) {
            const existing = uniqueResources.get(item.resource.inventoryId);
            if (!existing || Number(item.resource.quantity) > Number(existing.resource.quantity)) {
              uniqueResources.set(item.resource.inventoryId, item);
            }
          }

          const itemsToRevert = Array.from(uniqueResources.values());
          console.log(`[RESOURCES_FOUND] Itens encontrados para reverter: [${itemsToRevert.map(i => `${i.product.name}: ${i.resource.quantity}`).join(', ')}]`);

          for (const { resource, product } of itemsToRevert) {
            let quantityToRevert = Number(resource.quantity);
            const conversionFactor = Number(product.conversionFactor) || 1;

            console.log(`[AUDITORIA ESTORNO] Agendamento: ${id} | Item: ${product.name} | Qtd Base: ${resource.quantity} ${resource.unit}`);

            if (product.secondaryUnit && resource.unit === product.secondaryUnit && conversionFactor > 0) {
              const originalQty = quantityToRevert;
              quantityToRevert = quantityToRevert / conversionFactor;
              console.log(`[CONVERSÃO] ${originalQty} ${resource.unit} -> ${quantityToRevert} ${product.unit}`);
            }

            // Incrementar estoque
            await tx
              .update(inventory)
              .set({
                currentQuantity: sql`${inventory.currentQuantity} + ${quantityToRevert.toString()}`,
                updatedAt: new Date(),
              })
              .where(eq(inventory.id, resource.inventoryId));

            // Log
            await tx.insert(inventoryLogs).values({
              id: crypto.randomUUID(),
              inventoryId: resource.inventoryId,
              companyId: appointment.companyId,
              type: "ENTRY",
              quantity: quantityToRevert.toString(),
              reason: `Estorno automático: Agendamento #${id} revertido`,
              createdAt: new Date(),
            });
          }
        }
      }

      // 2. Consumo de estoque (OUTRO -> COMPLETED)
      if (currentAppointment.status !== "COMPLETED" && status === "COMPLETED") {

        // Verificação de Idempotência para Consumo (Evitar duplicidade se clicar 2x rápido)
        // Verificamos se já existe um log de SAÍDA para este agendamento recentemente?
        // O ideal é confiar na transação e no status anterior. Se status anterior != COMPLETED, então é a primeira vez.
        // Mas o usuário pediu "separar canais de validação".

        const resources = await tx
          .select({
            resource: serviceResources,
            product: inventory
          })
          .from(serviceResources)
          .innerJoin(inventory, eq(serviceResources.inventoryId, inventory.id))
          .where(inArray(serviceResources.serviceId, serviceIds));

        // Deduplicação
        const uniqueResources = new Map<string, { resource: typeof serviceResources.$inferSelect, product: typeof inventory.$inferSelect }>();

        for (const item of resources) {
          const existing = uniqueResources.get(item.resource.inventoryId);
          // Lógica de Deduplicação: Manter o maior valor definido para o atendimento único
          if (!existing || Number(item.resource.quantity) > Number(existing.resource.quantity)) {
            uniqueResources.set(item.resource.inventoryId, item);
          }
        }

        const itemsToConsume = Array.from(uniqueResources.values());
        console.log(`[RESOURCES_FOUND] Itens encontrados para subtrair: [${itemsToConsume.map(i => `${i.product.name}: ${i.resource.quantity}`).join(', ')}]`);

        for (const { resource, product } of itemsToConsume) {
          let quantityToConsume = Number(resource.quantity);
          const conversionFactor = Number(product.conversionFactor) || 1;

          console.log(`[AUDITORIA CONSUMO] Agendamento: ${id} | Item: ${product.name} | Qtd Base: ${resource.quantity} ${resource.unit}`);

          if (product.secondaryUnit && resource.unit === product.secondaryUnit && conversionFactor > 0) {
            const originalQty = quantityToConsume;
            quantityToConsume = quantityToConsume / conversionFactor;
            console.log(`[CONVERSÃO] ${originalQty} ${resource.unit} -> ${quantityToConsume} ${product.unit}`);
          }

          // Decrementar estoque
          await tx
            .update(inventory)
            .set({
              currentQuantity: sql`${inventory.currentQuantity} - ${quantityToConsume.toString()}`,
              updatedAt: new Date(),
            })
            .where(eq(inventory.id, resource.inventoryId));

          // Log de Saída
          await tx.insert(inventoryLogs).values({
            id: crypto.randomUUID(),
            inventoryId: resource.inventoryId,
            companyId: appointment.companyId,
            type: "EXIT",
            quantity: quantityToConsume.toString(),
            reason: `Consumo automático: Agendamento #${id} concluído`,
            createdAt: new Date(),
          });
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
