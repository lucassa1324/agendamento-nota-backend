import { IAppointmentRepository } from "../../domain/ports/appointment.repository";
import { IServiceRepository } from "../../../services/domain/ports/service.repository";
import { IBusinessRepository } from "../../../business/domain/ports/business.repository";
import { CreateAppointmentInput } from "../../domain/entities/appointment.entity";
import { IPushSubscriptionRepository } from "../../../notifications/domain/ports/push-subscription.repository";
import { UserRepository } from "../../../user/adapters/out/user.repository";
import { NotificationService } from "../../../notifications/application/notification.service";
import { TransactionalEmailService } from "../../../notifications/application/transactional-email.service";
import { db } from "../../../infrastructure/drizzle/database";
import { scheduleBlocks } from "../../../../db/schema";
import { eq } from "drizzle-orm";
import {
  assertNoSchedulingConflict,
  parseDurationToMinutes,
} from "../utils/scheduling-conflict.util";
import { assertUserHasCompanyAccess } from "../utils/company-access.util";
import { AssignmentEngineService } from "../services/assignment-engine.service";

export class CreateAppointmentUseCase {
  private assignmentEngine = new AssignmentEngineService();

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

    // Se houver usuário logado, precisa ter acesso à empresa (owner ou staff ativo)
    if (userId) {
      await assertUserHasCompanyAccess(
        data.companyId,
        userId,
        "Unauthorized: User has no access to this company",
      );
    }

    // Regras antiabuso aplicadas somente no fluxo público (sem usuário logado)
    if (!userId) {
      const normalizePhone = (value: string) => value.replace(/\D/g, "");
      const isValidEmail = (value: string) =>
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      const activeStatuses = new Set(["PENDING", "CONFIRMED", "POSTPONED"]);
      const phoneLimitWithoutEmail = 3;
      const absolutePhoneLimit = 6;
      const sameDayActiveLimit = 2;
      const cooldownMinutes = 5;

      const phoneDigits = normalizePhone(data.customerPhone || "");
      const rawEmail = (data.customerEmail || "").trim().toLowerCase();
      const hasEmail = rawEmail.length > 0;

      if (phoneDigits.length !== 10 && phoneDigits.length !== 11) {
        throw new Error("ANTI_ABUSE: Informe um telefone com DDD válido.");
      }

      if (/^(\d)\1+$/.test(phoneDigits)) {
        throw new Error("ANTI_ABUSE: Informe um telefone real. Não use números repetidos.");
      }

      if (hasEmail && !isValidEmail(rawEmail)) {
        throw new Error("ANTI_ABUSE: Informe um e-mail válido para continuar.");
      }

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const companyAppointments = await this.appointmentRepository.findAllByCompanyId(
        data.companyId,
        thirtyDaysAgo,
      );

      const appointmentsByPhone = companyAppointments.filter((appointment) => {
        if (appointment.status === "CANCELLED") return false;
        return normalizePhone(appointment.customerPhone || "") === phoneDigits;
      });

      if (appointmentsByPhone.length >= phoneLimitWithoutEmail && !hasEmail) {
        throw new Error(
          "ANTI_ABUSE: Este telefone já realizou 3 agendamentos recentes. Para continuar, informe um e-mail válido.",
        );
      }

      if (appointmentsByPhone.length >= absolutePhoneLimit) {
        throw new Error(
          "ANTI_ABUSE: Limite de agendamentos para este telefone atingido temporariamente. Tente novamente mais tarde.",
        );
      }

      const now = Date.now();
      const hasRecentAttempt = appointmentsByPhone.some((appointment) => {
        const createdAtMs = new Date(appointment.createdAt).getTime();
        return Number.isFinite(createdAtMs) && now - createdAtMs < cooldownMinutes * 60 * 1000;
      });

      if (hasRecentAttempt) {
        throw new Error(
          "ANTI_ABUSE: Aguarde alguns minutos antes de realizar um novo agendamento com este telefone.",
        );
      }

      const scheduledDateKey = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Sao_Paulo",
      }).format(new Date(data.scheduledAt));

      const sameDayActiveByPhone = appointmentsByPhone.filter((appointment) => {
        if (!activeStatuses.has(appointment.status)) return false;
        const appointmentDateKey = new Intl.DateTimeFormat("en-CA", {
          timeZone: "America/Sao_Paulo",
        }).format(new Date(appointment.scheduledAt));
        return appointmentDateKey === scheduledDateKey;
      });

      if (sameDayActiveByPhone.length >= sameDayActiveLimit) {
        throw new Error(
          "ANTI_ABUSE: Este telefone já possui o limite de agendamentos ativos para este dia.",
        );
      }

      // Normaliza os campos para persistência e comparações futuras
      data.customerPhone = phoneDigits;
      data.customerEmail = rawEmail;
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
      totalDurationMin += parseDurationToMinutes(service.duration);
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

    const requestedStaffId = data.staffId ?? null;
    let targetStaffId = requestedStaffId;
    let assignedBy: "system" | "staff" = requestedStaffId ? "staff" : "system";
    let validationStatus: "suggested" | "confirmed" = requestedStaffId
      ? "confirmed"
      : "suggested";

    if (!targetStaffId) {
      const suggestion = await this.assignmentEngine.suggestProfessional({
        companyId: data.companyId,
        serviceIds,
        scheduledAt,
        durationMinutes: totalDurationMin,
      });
      if (suggestion.professionalId) {
        targetStaffId = suggestion.professionalId;
      }
    }

    data.staffId = targetStaffId ?? null;
    data.assignedBy = assignedBy;
    data.validationStatus = validationStatus;
    data.version = 1;

    const sameStaffAppointments = targetStaffId
      ? existingAppointments.filter((app) => app.staffId === targetStaffId)
      : [];
    const staffScheduleBlocks = targetStaffId
      ? await db
        .select({
          startTime: scheduleBlocks.startTime,
          endTime: scheduleBlocks.endTime,
          isOverrideable: scheduleBlocks.isOverrideable,
        })
        .from(scheduleBlocks)
        .where(eq(scheduleBlocks.staffId, targetStaffId))
      : [];

    assertNoSchedulingConflict({
      scheduledAt,
      durationMinutes: totalDurationMin,
      existingAppointments: sameStaffAppointments,
      scheduleBlocks: staffScheduleBlocks.map((block) => ({
        startTime: new Date(block.startTime),
        endTime: new Date(block.endTime),
        isOverrideable: block.isOverrideable,
      })),
      force: Boolean(data.force && userId),
    });

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
    data.createdBy = userId ?? null;
    data.auditLog = [
      ...(data.auditLog ?? []),
      {
        action: "Appointment created",
        user: userId ?? "public",
        date: new Date().toISOString(),
      },
    ];

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
