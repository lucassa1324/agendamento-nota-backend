import { IAppointmentRepository } from "../../domain/ports/appointment.repository";
import { AppointmentStatus, Appointment } from "../../domain/entities/appointment.entity";
import { IBusinessRepository } from "../../../business/domain/ports/business.repository";
import { UserRepository } from "../../../user/adapters/out/user.repository";
import { IPushSubscriptionRepository } from "../../../notifications/domain/ports/push-subscription.repository";
import { NotificationService } from "../../../notifications/application/notification.service";
import { db } from "../../../infrastructure/drizzle/database";
import { appointments, serviceResources, inventory, inventoryLogs } from "../../../../db/schema";
import { eq, sql } from "drizzle-orm";

export class UpdateAppointmentStatusUseCase {
  constructor(
    private appointmentRepository: IAppointmentRepository,
    private businessRepository: IBusinessRepository,
    private userRepository: UserRepository,
    private pushSubscriptionRepository: IPushSubscriptionRepository
  ) { }

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

      // 1. Reversão de estoque se necessário
      // Usa o status atual do banco (dentro da tx) em vez do status lido anteriormente
      if (currentAppointment.status === "COMPLETED" && status !== "COMPLETED") {

        // Verificação de Idempotência: Checar se já houve estorno recente para este agendamento
        // Isso previne que reexecuções acidentais ou chamadas duplicadas somem estoque novamente
        const existingLog = await tx
          .select()
          .from(inventoryLogs)
          .where(sql`${inventoryLogs.reason} LIKE ${`%Agendamento #${id} revertido%`}`)
          .limit(1);

        if (existingLog.length > 0) {
          console.log(`[IDEMPOTÊNCIA] Estorno já realizado para agendamento #${id}. Pulando reversão de estoque.`);
        } else {
          // Buscar itens consumidos pelo serviço com dados do produto
          const resources = await tx
            .select({
              resource: serviceResources,
              product: inventory
            })
            .from(serviceResources)
            .innerJoin(inventory, eq(serviceResources.inventoryId, inventory.id))
            .where(eq(serviceResources.serviceId, appointment.serviceId));

          for (const { resource, product } of resources) {
            let quantityToRevert = Number(resource.quantity);
            const conversionFactor = Number(product.conversionFactor) || 1;

            // Log inicial para auditoria
            console.log(`[AUDITORIA ESTORNO] Agendamento: ${id} | Item: ${product.name} | Qtd Consumida Original: ${resource.quantity} ${resource.unit}`);

            // Lógica de Conversão:
            // Se a unidade do recurso for a unidade secundária do produto,
            // precisamos converter para a unidade primária antes de devolver ao estoque.
            if (product.secondaryUnit && resource.unit === product.secondaryUnit && conversionFactor > 0) {
              // Exemplo: 1 Caixa (Pri) = 10 Unidades (Sec). Fator = 10.
              // Consumo: 5 Unidades (Sec).
              // Reversão: 5 / 10 = 0.5 Caixas (Pri).
              const originalQty = quantityToRevert;
              quantityToRevert = quantityToRevert / conversionFactor;
              console.log(`[CONVERSÃO] ${originalQty} ${resource.unit} -> ${quantityToRevert} ${product.unit} (Fator: ${conversionFactor})`);
            } else {
              console.log(`[SEM CONVERSÃO] Mantendo quantidade: ${quantityToRevert} ${product.unit}`);
            }

            console.log(`[AÇÃO] Incrementando estoque de ${product.name}: +${quantityToRevert}`);

            // Incrementar estoque
            await tx
              .update(inventory)
              .set({
                currentQuantity: sql`${inventory.currentQuantity} + ${quantityToRevert.toString()}`,
                updatedAt: new Date(),
              })
              .where(eq(inventory.id, resource.inventoryId));

            // Registrar log de entrada (estorno)
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

      // 2. Atualizar status do agendamento
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
