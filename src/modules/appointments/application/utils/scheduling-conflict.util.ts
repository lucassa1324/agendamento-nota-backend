import type { Appointment } from "../../domain/entities/appointment.entity";

type ScheduleBlockLike = {
  startTime: Date;
  endTime: Date;
  isOverrideable: boolean;
};

type ConflictInput = {
  scheduledAt: Date;
  durationMinutes: number;
  existingAppointments: Appointment[];
  scheduleBlocks?: ScheduleBlockLike[];
  currentAppointmentId?: string;
  force?: boolean;
  gridSizeMinutes?: number;
};

const CANCELLED_STATUS = "CANCELLED";

export const parseDurationToMinutes = (duration?: string | null): number => {
  if (!duration) return 30;
  if (duration.includes(":")) {
    const [h, m] = duration.split(":").map(Number);
    return (h * 60) + (m || 0);
  }
  if (/^\d+$/.test(duration)) {
    return parseInt(duration, 10);
  }
  return 30;
};

export function assertNoSchedulingConflict(input: ConflictInput): void {
  const gridSizeMinutes = input.gridSizeMinutes ?? 10;
  const start = input.scheduledAt;
  const end = new Date(start.getTime() + input.durationMinutes * 60_000);

  if (start.getUTCSeconds() !== 0 || start.getUTCMilliseconds() !== 0) {
    throw new Error("O agendamento deve estar alinhado ao grid de 10 minutos.");
  }
  if (start.getUTCMinutes() % gridSizeMinutes !== 0) {
    throw new Error("O agendamento deve estar alinhado ao grid de 10 minutos.");
  }

  const appointmentConflict = input.existingAppointments.some((appointment) => {
    if (appointment.id === input.currentAppointmentId) return false;
    if (appointment.status === CANCELLED_STATUS) return false;

    const existingStart = new Date(appointment.scheduledAt);
    const existingEnd = new Date(
      existingStart.getTime() + parseDurationToMinutes(appointment.serviceDurationSnapshot) * 60_000,
    );

    return start < existingEnd && end > existingStart;
  });

  if (appointmentConflict) {
    throw new Error("O horário selecionado já está ocupado.");
  }

  const scheduleBlocks = input.scheduleBlocks ?? [];
  if (scheduleBlocks.length === 0) return;

  const blockingConflicts = scheduleBlocks.filter((block) => {
    const hasOverlap = start < block.endTime && end > block.startTime;
    if (!hasOverlap) return false;
    if (input.force && block.isOverrideable) return false;
    return true;
  });

  if (blockingConflicts.length > 0) {
    throw new Error("Existe um bloqueio de agenda para o horário selecionado.");
  }
}
