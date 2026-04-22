import { IAppointmentRepository } from "../../domain/ports/appointment.repository";
import { IBusinessRepository } from "../../../business/domain/ports/business.repository";
import { db } from "../../../infrastructure/drizzle/database";
import { scheduleBlocks } from "../../../../db/schema";
import { eq } from "drizzle-orm";
import {
  assertNoSchedulingConflict,
  parseDurationToMinutes,
} from "../utils/scheduling-conflict.util";

export class RescheduleAppointmentUseCase {
  constructor(
    private appointmentRepository: IAppointmentRepository,
    private businessRepository: IBusinessRepository,
  ) { }

  async execute(id: string, scheduledAt: Date, userId: string, force = false) {
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

    const durationMin = parseDurationToMinutes(
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

    const sameStaffAppointments = appointment.staffId
      ? existingAppointments.filter((app) => app.staffId === appointment.staffId)
      : [];
    const staffScheduleBlocks = appointment.staffId
      ? await db
        .select({
          startTime: scheduleBlocks.startTime,
          endTime: scheduleBlocks.endTime,
          isOverrideable: scheduleBlocks.isOverrideable,
        })
        .from(scheduleBlocks)
        .where(eq(scheduleBlocks.staffId, appointment.staffId))
      : [];

    assertNoSchedulingConflict({
      scheduledAt,
      durationMinutes: durationMin,
      existingAppointments: sameStaffAppointments,
      scheduleBlocks: staffScheduleBlocks.map((block) => ({
        startTime: new Date(block.startTime),
        endTime: new Date(block.endTime),
        isOverrideable: block.isOverrideable,
      })),
      currentAppointmentId: appointment.id,
      force,
    });

    const updated = await this.appointmentRepository.updateSchedule(id, scheduledAt, [
      ...(appointment.auditLog ?? []),
      {
        action: "Appointment rescheduled",
        user: userId,
        date: new Date().toISOString(),
      },
    ]);
    if (!updated) {
      throw new Error("Appointment not found");
    }

    return updated;
  }
}
