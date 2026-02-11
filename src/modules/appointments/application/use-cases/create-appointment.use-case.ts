import { IAppointmentRepository } from "../../domain/ports/appointment.repository";
import { IServiceRepository } from "../../../services/domain/ports/service.repository";
import { IBusinessRepository } from "../../../business/domain/ports/business.repository";
import { CreateAppointmentInput } from "../../domain/entities/appointment.entity";

export class CreateAppointmentUseCase {
  constructor(
    private appointmentRepository: IAppointmentRepository,
    private serviceRepository: IServiceRepository,
    private businessRepository: IBusinessRepository
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

    // Suporte a múltiplos serviços (string separada por vírgula)
    const serviceIds = data.serviceId.split(',').map(id => id.trim());
    const services = [];
    let totalDurationMin = 0;
    let totalPrice = 0;
    let combinedServiceNames = [];

    for (const sId of serviceIds) {
      const service = await this.serviceRepository.findById(sId);
      if (!service) {
        throw new Error(`Service not found: ${sId}`);
      }
      if (service.companyId !== data.companyId) {
        throw new Error(`Service ${service.name} does not belong to this company`);
      }
      
      services.push(service);
      combinedServiceNames.push(service.name);
      
      // Somar preços
      totalPrice += Number(service.price);

      // Somar durações
      let dMin = 30;
      if (service.duration.includes(':')) {
        const [h, m] = service.duration.split(':').map(Number);
        dMin = (h * 60) + m;
      } else {
        dMin = parseInt(service.duration) || 30;
      }
      totalDurationMin += dMin;
    }

    // IMPORTANTE: Para evitar erro de Chave Estrangeira (FK) no banco,
    // o campo 'serviceId' deve conter apenas UM ID válido existente na tabela 'services'.
    // Vamos usar o primeiro ID da lista para a FK, mas salvar TODOS no snapshot.
    const originalServiceId = data.serviceId; // Mantém a string original se precisarmos
    data.serviceId = serviceIds[0]; 

    // Preparar dados com valores somados
    const totalDurationStr = `${String(Math.floor(totalDurationMin / 60)).padStart(2, '0')}:${String(totalDurationMin % 60).padStart(2, '0')}`;
    
    // Atualizar o objeto data com os valores calculados para o snapshot
    data.serviceNameSnapshot = combinedServiceNames.join(', ');
    data.servicePriceSnapshot = totalPrice.toFixed(2);
    data.serviceDurationSnapshot = totalDurationStr;
    // Opcional: Você pode querer salvar a lista original de IDs nas notas ou em outro campo snapshot se necessário
    data.notes = data.notes ? `${data.notes} | IDs: ${originalServiceId}` : `IDs: ${originalServiceId}`;

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
      throw new Error("Selected time and total duration exceed business hours");
    }

    // Validar conflitos com outros agendamentos
    const existingAppointments = await this.appointmentRepository.findAllByCompanyId(
      data.companyId,
      new Date(new Date(scheduledAt).setHours(0, 0, 0, 0)),
      new Date(new Date(scheduledAt).setHours(23, 59, 59, 999))
    );

    const appStartMin = (scheduledAt.getHours() * 60) + scheduledAt.getMinutes();
    const appEndMin = appStartMin + totalDurationMin;

    const hasConflict = existingAppointments.some(app => {
      if (app.status === 'CANCELLED') return false;

      const existingStart = (app.scheduledAt.getHours() * 60) + app.scheduledAt.getMinutes();
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

      // Sobreposição: (NovoInício < ExistenteFim) E (NovoFim > ExistenteInício)
      return appStartMin < existingEnd && appEndMin > existingStart;
    });

    if (hasConflict) {
      throw new Error("Selected time slot is already occupied");
    }

    return await this.appointmentRepository.create(data);
  }
}
