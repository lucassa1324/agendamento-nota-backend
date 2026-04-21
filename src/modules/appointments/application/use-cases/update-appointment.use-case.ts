import { IAppointmentRepository } from "../../domain/ports/appointment.repository";
import { IServiceRepository } from "../../../services/domain/ports/service.repository";
import { IBusinessRepository } from "../../../business/domain/ports/business.repository";
import { UpdateAppointmentInput } from "../../domain/entities/appointment.entity";

type UpdateAppointmentCommand = {
  id: string;
  scheduledAt: Date;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  serviceId: string;
  servicePriceSnapshot: string;
  notes?: string;
  ignoreBusinessHoursValidation?: boolean;
};

export class UpdateAppointmentUseCase {
  constructor(
    private appointmentRepository: IAppointmentRepository,
    private serviceRepository: IServiceRepository,
    private businessRepository: IBusinessRepository,
  ) { }

  private parseDurationToMinutes(duration: string): number {
    if (!duration) return 30;
    if (duration.includes(":")) {
      const [h, m] = duration.split(":").map(Number);
      return (h * 60) + (m || 0);
    }
    if (/^\d+$/.test(duration)) {
      return parseInt(duration, 10);
    }
    return 30;
  }

  private formatMinutesToHHmm(totalMinutes: number): string {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  async execute(data: UpdateAppointmentCommand, userId: string) {
    const appointment = await this.appointmentRepository.findById(data.id);
    if (!appointment) {
      throw new Error("Appointment not found");
    }

    const business = await this.businessRepository.findById(appointment.companyId);
    if (!business || business.ownerId !== userId) {
      throw new Error("Unauthorized to update this appointment");
    }

    const serviceIds = data.serviceId
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    if (serviceIds.length === 0) {
      throw new Error("Nenhum serviço selecionado para atualização.");
    }

    const services = [];
    let totalDurationMin = 0;
    for (const sId of serviceIds) {
      const service = await this.serviceRepository.findById(sId);
      if (!service) throw new Error(`Service not found: ${sId}`);
      if (service.companyId !== appointment.companyId) {
        throw new Error(`Service ${service.name} does not belong to this company`);
      }
      services.push(service);
      totalDurationMin += this.parseDurationToMinutes(service.duration);
    }

    const serviceNameSnapshot = services.map((s) => s.name).join(", ");
    const serviceDurationSnapshot = this.formatMinutesToHHmm(totalDurationMin);
    const servicePriceSnapshot = Number(data.servicePriceSnapshot || 0).toFixed(2);
    const items = services.map((service) => ({
      serviceId: service.id,
      serviceNameSnapshot: service.name,
      servicePriceSnapshot: service.price,
      serviceDurationSnapshot: service.duration,
    }));

    const formatter = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    const parts = formatter.formatToParts(data.scheduledAt);
    const getPart = (type: string) =>
      parts.find((p) => p.type === type)?.value || "00";
    const appH = parseInt(getPart("hour"), 10);
    const appM = parseInt(getPart("minute"), 10);
    const appStartMin = (appH * 60) + appM;
    const appEndMin = appStartMin + totalDurationMin;

    if (!data.ignoreBusinessHoursValidation) {
      const weekdayMap: Record<string, number> = {
        "domingo": 0,
        "segunda-feira": 1,
        "terça-feira": 2,
        "quarta-feira": 3,
        "quinta-feira": 4,
        "sexta-feira": 5,
        "sábado": 6,
      };
      const dayOfWeek = weekdayMap[getPart("weekday").toLowerCase()] ?? data.scheduledAt.getDay();
      const dayNames = ["DOMINGO", "SEGUNDA", "TERCA", "QUARTA", "QUINTA", "SEXTA", "SABADO"];
      const dayName = dayNames[dayOfWeek];

      const settings = await this.businessRepository.getOperatingHours(appointment.companyId);
      if (!settings) {
        throw new Error("Business operating hours not configured");
      }

      const dayConfig = settings.weekly.find((w: any) =>
        String(w.dayOfWeek) === String(dayOfWeek) ||
        String(w.dayOfWeek).toUpperCase() === dayName,
      );

      if (!dayConfig || dayConfig.status === "CLOSED") {
        throw new Error("Business is closed on this day");
      }

      const checkTimeInPeriod = (startStr?: string | null, endStr?: string | null) => {
        if (!startStr || !endStr) return false;
        const [sH, sM] = startStr.split(":").map(Number);
        const [eH, eM] = endStr.split(":").map(Number);
        const startMin = (sH * 60) + sM;
        const endMin = (eH * 60) + eM;
        return appStartMin >= startMin && appEndMin <= endMin;
      };

      const isInMorning = checkTimeInPeriod(dayConfig.morningStart, dayConfig.morningEnd);
      const isInAfternoon = checkTimeInPeriod(dayConfig.afternoonStart, dayConfig.afternoonEnd);
      if (!isInMorning && !isInAfternoon) {
        throw new Error("O horário selecionado e a duração total excedem o horário de funcionamento.");
      }
    }

    const year = getPart("year");
    const month = getPart("month");
    const day = getPart("day");
    const startOfDay = new Date(`${year}-${month}-${day}T00:00:00.000-03:00`);
    const endOfDay = new Date(`${year}-${month}-${day}T23:59:59.999-03:00`);

    const existingAppointments = await this.appointmentRepository.findAllByCompanyId(
      appointment.companyId,
      startOfDay,
      endOfDay,
    );

    const hasConflict = existingAppointments.some((app) => {
      if (app.id === appointment.id || app.status === "CANCELLED") return false;

      const dbDate = new Date(app.scheduledAt);
      const dbParts = formatter.formatToParts(dbDate);
      const dbH = parseInt(dbParts.find((p) => p.type === "hour")?.value || "0", 10);
      const dbM = parseInt(dbParts.find((p) => p.type === "minute")?.value || "0", 10);
      const existingStart = (dbH * 60) + dbM;
      const existingDuration = this.parseDurationToMinutes(app.serviceDurationSnapshot || "30");
      const existingEnd = existingStart + existingDuration;
      return appStartMin < existingEnd && appEndMin > existingStart;
    });

    if (hasConflict) {
      throw new Error("O horário selecionado já está ocupado.");
    }

    const updatePayload: UpdateAppointmentInput = {
      serviceId: serviceIds.join(","),
      customerName: data.customerName,
      customerEmail: data.customerEmail,
      customerPhone: data.customerPhone,
      serviceNameSnapshot,
      servicePriceSnapshot,
      serviceDurationSnapshot,
      scheduledAt: data.scheduledAt,
      notes: data.notes,
      items,
    };

    const updated = await this.appointmentRepository.update(appointment.id, updatePayload);
    if (!updated) {
      throw new Error("Appointment not found");
    }
    return updated;
  }
}
