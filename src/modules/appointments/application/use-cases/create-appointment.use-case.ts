import { IAppointmentRepository } from "../../domain/ports/appointment.repository";
import { IServiceRepository } from "../../../services/domain/ports/service.repository";
import { IBusinessRepository } from "../../../business/domain/ports/business.repository";
import { CreateAppointmentInput } from "../../domain/entities/appointment.entity";
import { IPushSubscriptionRepository } from "../../../notifications/domain/ports/push-subscription.repository";
import { UserRepository } from "../../../user/adapters/out/user.repository";
import { NotificationService } from "../../../notifications/application/notification.service";

export class CreateAppointmentUseCase {
  constructor(
    private appointmentRepository: IAppointmentRepository,
    private serviceRepository: IServiceRepository,
    private businessRepository: IBusinessRepository,
    private pushSubscriptionRepository: IPushSubscriptionRepository,
    private userRepository: UserRepository
  ) { }

  async execute(data: CreateAppointmentInput, userId?: string) {
    // Valida se a empresa existe
    const business = await this.businessRepository.findById(data.companyId);
    if (!business) {
      throw new Error("Business not found");
    }

    // Se houver um userId, validamos se é o dono (agendamento manual via admin)
    if (userId && business.ownerId !== userId) {
      throw new Error("Unauthorized: Only business owners can create manual appointments");
    }

    // Suporte a múltiplos serviços
    let serviceIds: string[] = [];

    // Prioridade 1: Se o frontend enviou a lista detalhada de itens (Novo padrão)
    if (data.items && data.items.length > 0) {
      serviceIds = data.items.map(it => it.serviceId);
    }
    // Prioridade 2: Se enviou IDs separados por vírgula na string serviceId (Fallback/Legado)
    else if (typeof data.serviceId === 'string' && data.serviceId.includes(',')) {
      serviceIds = data.serviceId.split(',').map(id => id.trim()).filter(id => id !== "");
    }
    // Prioridade 3: Apenas um ID simples
    else if (data.serviceId) {
      serviceIds = [data.serviceId];
    }

    if (serviceIds.length === 0) {
      throw new Error("Nenhum serviço selecionado para o agendamento");
    }

    const services = [];
    let totalDurationMin = 0;
    let totalPrice = 0;
    let combinedServiceNames = [];
    const appointmentItemsList = [];

    for (const sId of serviceIds) {
      const service = await this.serviceRepository.findById(sId);
      if (!service) {
        console.error(`[CREATE_APPOINTMENT_ERROR] Service not found: "${sId}". Full data:`, JSON.stringify(data));
        throw new Error(`Service not found: ${sId}. O ID enviado pelo frontend não existe no banco de dados.`);
      }

      if (service.companyId !== data.companyId) {
        throw new Error(`Service ${service.name} does not belong to this company`);
      }
      services.push(service);

      // Calcula a duração total do agendamento
      const [hours, minutes] = service.duration.split(':').map(Number);
      totalDurationMin += (hours * 60) + minutes;
    }

    // Define o ID do serviço principal como o primeiro (necessário para compatibilidade com a FK do banco)
    data.serviceId = serviceIds[0];

    // Snapshot final com todos os nomes dos serviços se houver múltiplos
    if (services.length > 1) {
      data.serviceNameSnapshot = services.map(s => s.name).join(', ');
      data.servicePriceSnapshot = services.reduce((acc, s) => acc + parseFloat(s.price), 0).toString();

      const totalHours = Math.floor(totalDurationMin / 60);
      const totalMins = totalDurationMin % 60;
      data.serviceDurationSnapshot = `${String(totalHours).padStart(2, '0')}:${String(totalMins).padStart(2, '0')}`;
    }

    // Criar a lista de AppointmentItem a partir dos serviços carregados
    const items = services.map(service => ({
      serviceId: service.id,
      serviceNameSnapshot: service.name,
      servicePriceSnapshot: service.price,
      serviceDurationSnapshot: service.duration,
    }));

    // Agora substituímos os itens que podem ter vindo incompletos do front pelos dados reais do banco
    data.items = items;

    // Valida disponibilidade de horário
    const scheduledAt = new Date(data.scheduledAt);
    const dayOfWeek = scheduledAt.getUTCDay();
    const dayNames = ["DOMINGO", "SEGUNDA", "TERCA", "QUARTA", "QUINTA", "SEXTA", "SABADO"];
    const dayName = dayNames[dayOfWeek];

    const settings = await this.businessRepository.getOperatingHours(data.companyId);
    if (!settings) {
      throw new Error("Business operating hours not configured");
    }

    const dayConfig = settings.weekly.find((w: any) =>
      String(w.dayOfWeek) === String(dayOfWeek) ||
      String(w.dayOfWeek).toUpperCase() === dayName
    );

    if (!dayConfig || dayConfig.status === "CLOSED") {
      throw new Error("Business is closed on this day");
    }

    // Validar se o horário está dentro do expediente (usando horário local para comparação com HH:mm do config)
    const appH = scheduledAt.getHours();
    const appM = scheduledAt.getMinutes();
    const appTimeTotalMin = (appH * 60) + appM;

    const checkTimeInPeriod = (startStr?: string | null, endStr?: string | null) => {
      if (!startStr || !endStr) return false;
      const [sH, sM] = startStr.split(':').map(Number);
      const [eH, eM] = endStr.split(':').map(Number);
      const startMin = (sH * 60) + sM;
      const endMin = (eH * 60) + eM;
      return appTimeTotalMin >= startMin && (appTimeTotalMin + totalDurationMin) <= endMin;
    };

    const isInMorning = checkTimeInPeriod(dayConfig.morningStart, dayConfig.morningEnd);
    const isInAfternoon = checkTimeInPeriod(dayConfig.afternoonStart, dayConfig.afternoonEnd);

    if (!isInMorning && !isInAfternoon) {
      throw new Error("O horário selecionado e a duração total excedem o horário de funcionamento.");
    }

    // Validar conflitos com outros agendamentos
    const existingAppointments = await this.appointmentRepository.findAllByCompanyId(
      data.companyId,
      new Date(new Date(scheduledAt).setHours(0, 0, 0, 0)),
      new Date(new Date(scheduledAt).setHours(23, 59, 59, 999))
    );

    // Converte a data do agendamento para o timezone local (simulando a mesma lógica do banco/visualização)
    const appStartMin = (scheduledAt.getHours() * 60) + scheduledAt.getMinutes();
    const appEndMin = appStartMin + totalDurationMin;

    const hasConflict = existingAppointments.some(app => {
      if (app.status === 'CANCELLED') return false;

      const dbDate = new Date(app.scheduledAt);

      if (dbDate.getDate() !== scheduledAt.getDate() || dbDate.getMonth() !== scheduledAt.getMonth()) {
        return false;
      }

      const existingStart = (dbDate.getHours() * 60) + dbDate.getMinutes();

      let existingDuration = 30;
      if (app.serviceDurationSnapshot) {
        if (app.serviceDurationSnapshot.includes(':')) {
          const [dH, dM] = app.serviceDurationSnapshot.split(':').map(Number);
          existingDuration = (dH * 60) + dM;
        } else if (/^\d+$/.test(app.serviceDurationSnapshot)) {
          existingDuration = parseInt(app.serviceDurationSnapshot);
        }
      }
      const existingEnd = existingStart + existingDuration;

      return appStartMin < existingEnd && appEndMin > existingStart;
    });

    if (hasConflict) {
      throw new Error("O horário selecionado já está ocupado.");
    }

    // --- NOVA VALIDAÇÃO: PROCEDIMENTOS INCOMPATÍVEIS (Advanced Rules) ---
    // Verifica se o cliente já tem agendamentos no MESMO DIA que sejam incompatíveis com os novos serviços
    const customerAppointments = existingAppointments.filter(app => {
      if (app.status === 'CANCELLED') return false;

      // Verifica se é o mesmo cliente (por ID, Email ou Telefone)
      const isSameCustomer =
        (data.customerId && app.customerId === data.customerId) ||
        (data.customerEmail && app.customerEmail === data.customerEmail) ||
        (data.customerPhone && app.customerPhone === data.customerPhone);

      // Verifica se é o mesmo dia
      const appDate = new Date(app.scheduledAt);
      const isSameDay = appDate.getDate() === scheduledAt.getDate() && appDate.getMonth() === scheduledAt.getMonth();

      return isSameCustomer && isSameDay;
    });

    if (customerAppointments.length > 0) {
      for (const existingApp of customerAppointments) {
        const existingService = await this.serviceRepository.findById(existingApp.serviceId);
        if (!existingService) continue;

        const existingConflicts = (existingService.advancedRules as any)?.conflicts || [];

        for (const newService of services) {
          const newConflicts = (newService.advancedRules as any)?.conflicts || [];

          // 1. O serviço existente proíbe o novo?
          if (existingConflicts.includes(newService.id)) {
            throw new Error(`Conflito: O serviço '${newService.name}' não pode ser realizado no mesmo dia que '${existingService.name}'`);
          }

          // 2. O novo serviço proíbe o existente?
          if (newConflicts.includes(existingService.id)) {
            throw new Error(`Conflito: O serviço '${newService.name}' não pode ser realizado no mesmo dia que '${existingService.name}'`);
          }
        }
      }
    }

    // Persistência no repositório
    const newAppointment = await this.appointmentRepository.create(data);

    // Web Push Notification: notify business owner about the new appointment
    // Executamos em background (sem await) para não travar a resposta para o cliente
    (async () => {
      try {
        const ownerId = business.ownerId;
        const owner = await this.userRepository.find(ownerId);

        if (owner && owner.notifyNewAppointments) {
          const notificationService = new NotificationService(this.pushSubscriptionRepository);

          const date = new Date(newAppointment.scheduledAt);
          const formatter = new Intl.DateTimeFormat('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'America/Sao_Paulo'
          });
          const formattedDate = formatter.format(date);

          await notificationService.sendToUser(
            ownerId,
            "📅 Novo Agendamento!",
            `${newAppointment.customerName} agendou ${newAppointment.serviceNameSnapshot} para ${formattedDate}`
          );
          console.log(`[WEBPUSH] Notificação de agendamento enviada para ${owner.email}`);
        }
      } catch (notifyError: any) {
        console.error("[WEBPUSH_TRIGGER_ERROR]", notifyError?.message || notifyError);
      }
    })();

    return newAppointment;
  }
}
