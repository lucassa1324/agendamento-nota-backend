import { IAppointmentRepository } from "../../domain/ports/appointment.repository";
import { IServiceRepository } from "../../../services/domain/ports/service.repository";
import { IBusinessRepository } from "../../../business/domain/ports/business.repository";
import { CreateAppointmentInput } from "../../domain/entities/appointment.entity";
import { IPushSubscriptionRepository } from "../../../notifications/domain/ports/push-subscription.repository";
import { UserRepository } from "../../../user/adapters/out/user.repository";
import { NotificationService } from "../../../notifications/application/notification.service";
import { TransactionalEmailService } from "../../../notifications/application/transactional-email.service";

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
      let durationMin = 0;
      if (service.duration && typeof service.duration === 'string') {
        if (service.duration.includes(':')) {
          const [h, m] = service.duration.split(':').map(Number);
          durationMin = (h * 60) + (m || 0);
        } else if (/^\d+$/.test(service.duration)) {
          durationMin = parseInt(service.duration);
        }
      }
      totalDurationMin += durationMin;
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
    data.scheduledAt = scheduledAt; // Garante que o campo no objeto data seja um objeto Date para o Drizzle

    // Obter data e hora no fuso horário de Brasília (America/Sao_Paulo)
    // Isso garante que a validação funcione independente do fuso horário do servidor (ex: Vercel em UTC)
    const formatter = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false
    });

    const parts = formatter.formatToParts(scheduledAt);
    const getPart = (type: string) => parts.find(p => p.type === type)?.value;

    if (!userId) {
      const nowInBrt = new Date();
      const nowParts = formatter.formatToParts(nowInBrt);
      const getNowPart = (type: string) =>
        nowParts.find((p) => p.type === type)?.value || "00";

      const scheduledDateKey = `${getPart("year")}${getPart("month")}${getPart("day")}`;
      const nowDateKey = `${getNowPart("year")}${getNowPart("month")}${getNowPart("day")}`;
      const scheduledMinuteOfDay =
        parseInt(getPart("hour") || "0") * 60 + parseInt(getPart("minute") || "0");
      const nowMinuteOfDay =
        parseInt(getNowPart("hour")) * 60 + parseInt(getNowPart("minute"));

      const isPastDate = Number(scheduledDateKey) < Number(nowDateKey);
      const isPastTimeSameDay =
        scheduledDateKey === nowDateKey && scheduledMinuteOfDay <= nowMinuteOfDay;

      if (isPastDate || isPastTimeSameDay) {
        throw new Error("Não é possível agendar em horário passado.");
      }
    }

    // Mapeamento de dia da semana do Intl para o nosso padrão
    const weekdayMap: Record<string, number> = {
      'domingo': 0, 'segunda-feira': 1, 'terça-feira': 2, 'quarta-feira': 3,
      'quinta-feira': 4, 'sexta-feira': 5, 'sábado': 6
    };

    const weekdayStr = getPart('weekday')?.toLowerCase() || '';
    const dayOfWeek = weekdayMap[weekdayStr] ?? scheduledAt.getDay(); // fallback para o dia local se falhar

    const dayNames = ["DOMINGO", "SEGUNDA", "TERCA", "QUARTA", "QUINTA", "SEXTA", "SABADO"];
    const dayName = dayNames[dayOfWeek];
    const shouldIgnoreBusinessHours =
      Boolean(data.ignoreBusinessHoursValidation) && Boolean(userId);

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

    // Validar se o horário está dentro do expediente (usando horário local de Brasília)
    const appH = parseInt(getPart('hour') || '0');
    const appM = parseInt(getPart('minute') || '0');
    const appTimeTotalMin = (appH * 60) + appM;

    if (!userId) {
      const minimumBookingLeadMinutes = Math.max(
        0,
        Number((settings as any).minimumBookingLeadMinutes ?? 0),
      );
      if (minimumBookingLeadMinutes > 0) {
        const nowParts = formatter.formatToParts(new Date());
        const getNowPart = (type: string) =>
          nowParts.find((p) => p.type === type)?.value || "00";
        const scheduledDateKey = `${getPart("year")}${getPart("month")}${getPart("day")}`;
        const nowDateKey = `${getNowPart("year")}${getNowPart("month")}${getNowPart("day")}`;
        if (scheduledDateKey === nowDateKey) {
          const nowMinuteOfDay =
            parseInt(getNowPart("hour")) * 60 + parseInt(getNowPart("minute"));
          const diffMinutes = appTimeTotalMin - nowMinuteOfDay;
          if (diffMinutes < minimumBookingLeadMinutes) {
            throw new Error(
              `É necessário agendar com pelo menos ${minimumBookingLeadMinutes} minutos de antecedência.`,
            );
          }
        }
      }
    }

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

    if (!shouldIgnoreBusinessHours && !isInMorning && !isInAfternoon) {
      throw new Error("O horário selecionado e a duração total excedem o horário de funcionamento.");
    }

    // --- BUSCA DE AGENDAMENTOS EXISTENTES (Intervalo de 24h em BRT) ---
    // Precisamos buscar agendamentos que caem no mesmo dia em Brasília
    const day = getPart('day');
    const month = getPart('month');
    const year = getPart('year');

    // Criamos as datas de início e fim do dia no timezone de Brasília
    // BRT é UTC-3. Então 00:00 BRT = 03:00 UTC.
    const startOfDay = new Date(`${year}-${month}-${day}T00:00:00.000-03:00`);
    const endOfDay = new Date(`${year}-${month}-${day}T23:59:59.999-03:00`);

    // Validar conflitos com outros agendamentos
    const existingAppointments = await this.appointmentRepository.findAllByCompanyId(
      data.companyId,
      startOfDay,
      endOfDay
    );

    // Converte a data do agendamento para o timezone local de Brasília
    const appStartMin = appTimeTotalMin;
    const appEndMin = appStartMin + totalDurationMin;

    const hasConflict = existingAppointments.some(app => {
      if (app.status === 'CANCELLED') return false;

      const dbDate = new Date(app.scheduledAt);

      // Comparação de dia usando o timezone de Brasília
      const dbDateParts = formatter.formatToParts(dbDate);
      const dbDay = dbDateParts.find(p => p.type === 'day')?.value;
      const dbMonth = dbDateParts.find(p => p.type === 'month')?.value;
      const schDay = parts.find(p => p.type === 'day')?.value;
      const schMonth = parts.find(p => p.type === 'month')?.value;

      if (dbDay !== schDay || dbMonth !== schMonth) {
        return false;
      }

      const dbH = parseInt(dbDateParts.find(p => p.type === 'hour')?.value || '0');
      const dbM = parseInt(dbDateParts.find(p => p.type === 'minute')?.value || '0');
      const existingStart = (dbH * 60) + dbM;

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
        const transactionalEmailService = new TransactionalEmailService();

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

          const result = await notificationService.sendToUser(
            ownerId,
            "📅 Novo Agendamento!",
            `${newAppointment.customerName} agendou ${newAppointment.serviceNameSnapshot} para ${formattedDate}`
          );
          console.log(`[WEBPUSH] Notificação de agendamento enviada para ${owner.email}. Resultado:`, result);
        } else {
          console.log(`[WEBPUSH] Notificação ignorada para ${owner?.email}. Owner found: ${!!owner}, notifyNewAppointments: ${owner?.notifyNewAppointments}`);
        }

        if (data.customerEmail) {
          await transactionalEmailService.sendAppointmentConfirmationToCustomer({
            to: data.customerEmail,
            customerName: newAppointment.customerName,
            serviceName: newAppointment.serviceNameSnapshot,
            businessName: business.name,
            scheduledAt: new Date(newAppointment.scheduledAt),
          });
        }

        if (owner?.email) {
          await transactionalEmailService.sendAppointmentAlertToOwner({
            to: owner.email,
            ownerName: owner.name || "Administrador",
            customerName: newAppointment.customerName,
            serviceName: newAppointment.serviceNameSnapshot,
            businessName: business.name,
            scheduledAt: new Date(newAppointment.scheduledAt),
          });
        }
      } catch (notifyError: any) {
        console.error("[WEBPUSH_TRIGGER_ERROR]", notifyError?.message || notifyError);
      }
    })();

    return newAppointment;
  }
}
