import { IAppointmentRepository } from "../../domain/ports/appointment.repository";
import { IBusinessRepository } from "../../../business/domain/ports/business.repository";

export class RescheduleAppointmentUseCase {
  constructor(
    private appointmentRepository: IAppointmentRepository,
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

  async execute(id: string, scheduledAt: Date, userId: string) {
    const appointment = await this.appointmentRepository.findById(id);
    if (!appointment) {
      throw new Error("Appointment not found");
    }

    const business = await this.businessRepository.findById(appointment.companyId);
    if (!business || business.ownerId !== userId) {
      throw new Error("Unauthorized to reschedule this appointment");
    }

    if (appointment.status === "CANCELLED") {
      throw new Error("Não é possível reagendar um agendamento cancelado.");
    }

    const durationMin = this.parseDurationToMinutes(
      appointment.serviceDurationSnapshot || "30",
    );

    const formatter = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    const parts = formatter.formatToParts(scheduledAt);
    const getPart = (type: string) =>
      parts.find((p) => p.type === type)?.value || "00";
    const year = getPart("year");
    const month = getPart("month");
    const day = getPart("day");
    const appH = parseInt(getPart("hour"), 10);
    const appM = parseInt(getPart("minute"), 10);
    const appStartMin = (appH * 60) + appM;
    const appEndMin = appStartMin + durationMin;

    const startOfDay = new Date(`${year}-${month}-${day}T00:00:00.000-03:00`);
    const endOfDay = new Date(`${year}-${month}-${day}T23:59:59.999-03:00`);

    const existingAppointments = await this.appointmentRepository.findAllByCompanyId(
      appointment.companyId,
      startOfDay,
      endOfDay,
    );

    const hasConflict = existingAppointments.some((app) => {
      if (app.id === id || app.status === "CANCELLED") return false;

      const dbDate = new Date(app.scheduledAt);
      const dbParts = formatter.formatToParts(dbDate);
      const dbH = parseInt(
        dbParts.find((p) => p.type === "hour")?.value || "0",
        10,
      );
      const dbM = parseInt(
        dbParts.find((p) => p.type === "minute")?.value || "0",
        10,
      );
      const existingStart = (dbH * 60) + dbM;

      const existingDuration = this.parseDurationToMinutes(
        app.serviceDurationSnapshot || "30",
      );
      const existingEnd = existingStart + existingDuration;

      return appStartMin < existingEnd && appEndMin > existingStart;
    });

    if (hasConflict) {
      throw new Error("O horário selecionado já está ocupado.");
    }

    const updated = await this.appointmentRepository.updateSchedule(id, scheduledAt);
    if (!updated) {
      throw new Error("Appointment not found");
    }

    return updated;
  }
}
