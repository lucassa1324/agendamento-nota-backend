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
    // Se NÃO houver userId, é um agendamento público do cliente
    if (userId) {
      if (business.ownerId !== userId) {
        throw new Error("Unauthorized: Only business owners can create manual appointments");
      }
    }

    // Valida se o serviço pertence à empresa
    const service = await this.serviceRepository.findById(data.serviceId);

    if (!service) {
      throw new Error("Service not found");
    }

    if (service.companyId !== data.companyId) {
      throw new Error("Service does not belong to this company");
    }

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

    // Validar se o horário está dentro do expediente
    const appH = scheduledAt.getHours();
    const appM = scheduledAt.getMinutes();
    const appTimeTotalMin = (appH * 60) + appM;

    const checkTimeInPeriod = (startStr?: string | null, endStr?: string | null) => {
      if (!startStr || !endStr) return false;
      const [sH, sM] = startStr.split(':').map(Number);
      const [eH, eM] = endStr.split(':').map(Number);
      const startMin = (sH * 60) + sM;
      const endMin = (eH * 60) + eM;
      return appTimeTotalMin >= startMin && appTimeTotalMin < endMin;
    };

    const isInMorning = checkTimeInPeriod(dayConfig.morningStart, dayConfig.morningEnd);
    const isInAfternoon = checkTimeInPeriod(dayConfig.afternoonStart, dayConfig.afternoonEnd);

    if (!isInMorning && !isInAfternoon) {
      throw new Error("Selected time is outside business hours");
    }

    // Validar conflitos com outros agendamentos
    const existingAppointments = await this.appointmentRepository.findAllByCompanyId(
      data.companyId,
      new Date(scheduledAt.setUTCHours(0, 0, 0, 0)),
      new Date(scheduledAt.setUTCHours(23, 59, 59, 999))
    );

    // Reset scheduledAt para o valor original após o ajuste de busca
    scheduledAt.setTime(new Date(data.scheduledAt).getTime());

    const appStartMin = (scheduledAt.getUTCHours() * 60) + scheduledAt.getUTCMinutes();

    // Calcular duração do novo agendamento
    let durationMin = 30;
    if (data.serviceDurationSnapshot) {
      if (data.serviceDurationSnapshot.includes(':')) {
        const [dH, dM] = data.serviceDurationSnapshot.split(':').map(Number);
        durationMin = (dH * 60) + dM;
      } else if (/^\d+$/.test(data.serviceDurationSnapshot)) {
        durationMin = parseInt(data.serviceDurationSnapshot);
      }
    }
    const appEndMin = appStartMin + durationMin;

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
