import { and, eq, gte, inArray, lte } from "drizzle-orm";
import * as schema from "../../../../db/schema";
import { db } from "../../../infrastructure/drizzle/database";
import { parseDurationToMinutes } from "../utils/scheduling-conflict.util";

type SuggestAssignmentInput = {
  companyId: string;
  serviceIds: string[];
  scheduledAt: Date;
  durationMinutes: number;
};

type CandidateScore = {
  staffId: string;
  scoreGapMinutes: number;
  appointmentsCount: number;
};

type AssignmentSuggestion = {
  professionalId: string | null;
  reason: "gap_fill" | "no_candidate" | "no_available_slot";
  candidatesEvaluated: number;
};

export class AssignmentEngineService {
  private computeSameDayWindow(scheduledAt: Date) {
    const formatter = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const parts = formatter.formatToParts(scheduledAt);
    const getPart = (type: string) =>
      parts.find((p) => p.type === type)?.value || "00";
    const year = getPart("year");
    const month = getPart("month");
    const day = getPart("day");
    const startOfDay = new Date(`${year}-${month}-${day}T00:00:00.000-03:00`);
    const endOfDay = new Date(`${year}-${month}-${day}T23:59:59.999-03:00`);
    return { startOfDay, endOfDay };
  }

  private overlaps(
    startA: Date,
    endA: Date,
    startB: Date,
    endB: Date,
  ): boolean {
    return startA < endB && endA > startB;
  }

  async suggestProfessional(
    input: SuggestAssignmentInput,
  ): Promise<AssignmentSuggestion> {
    if (input.serviceIds.length === 0) {
      return {
        professionalId: null,
        reason: "no_candidate",
        candidatesEvaluated: 0,
      };
    }

    const candidateRows = await db
      .select({
        staffId: schema.staff.id,
        serviceId: schema.staffServices.serviceId,
      })
      .from(schema.staff)
      .innerJoin(
        schema.staffServices,
        eq(schema.staffServices.staffId, schema.staff.id),
      )
      .where(
        and(
          eq(schema.staff.companyId, input.companyId),
          eq(schema.staff.isActive, true),
          eq(schema.staff.isProfessional, true),
          inArray(schema.staffServices.serviceId, input.serviceIds),
        ),
      );

    if (candidateRows.length === 0) {
      return {
        professionalId: null,
        reason: "no_candidate",
        candidatesEvaluated: 0,
      };
    }

    const serviceSet = new Set(input.serviceIds);
    const candidateSkillMap = new Map<string, Set<string>>();
    for (const row of candidateRows) {
      const current = candidateSkillMap.get(row.staffId) || new Set<string>();
      current.add(row.serviceId);
      candidateSkillMap.set(row.staffId, current);
    }

    const fullyQualifiedCandidates = Array.from(candidateSkillMap.entries())
      .filter(([, skills]) => {
        for (const requiredServiceId of serviceSet) {
          if (!skills.has(requiredServiceId)) return false;
        }
        return true;
      })
      .map(([staffId]) => staffId);

    if (fullyQualifiedCandidates.length === 0) {
      return {
        professionalId: null,
        reason: "no_candidate",
        candidatesEvaluated: 0,
      };
    }

    const { startOfDay, endOfDay } = this.computeSameDayWindow(input.scheduledAt);
    const targetStart = input.scheduledAt;
    const targetEnd = new Date(
      targetStart.getTime() + input.durationMinutes * 60_000,
    );

    const appointments = await db
      .select({
        staffId: schema.appointments.staffId,
        scheduledAt: schema.appointments.scheduledAt,
        serviceDurationSnapshot: schema.appointments.serviceDurationSnapshot,
        status: schema.appointments.status,
      })
      .from(schema.appointments)
      .where(
        and(
          eq(schema.appointments.companyId, input.companyId),
          inArray(schema.appointments.staffId, fullyQualifiedCandidates),
          gte(schema.appointments.scheduledAt, startOfDay),
          lte(schema.appointments.scheduledAt, endOfDay),
        ),
      );

    const busyByStaff = new Map<
      string,
      Array<{ start: Date; end: Date }>
    >();
    for (const appt of appointments) {
      if (!appt.staffId) continue;
      if (appt.status === "CANCELLED") continue;
      const start = new Date(appt.scheduledAt);
      const end = new Date(
        start.getTime() +
          parseDurationToMinutes(appt.serviceDurationSnapshot) * 60_000,
      );
      const current = busyByStaff.get(appt.staffId) || [];
      current.push({ start, end });
      busyByStaff.set(appt.staffId, current);
    }

    const scores: CandidateScore[] = [];
    for (const staffId of fullyQualifiedCandidates) {
      const busy = busyByStaff.get(staffId) || [];
      const hasOverlap = busy.some((slot) =>
        this.overlaps(targetStart, targetEnd, slot.start, slot.end),
      );
      if (hasOverlap) continue;

      const previousSlots = busy
        .filter((slot) => slot.end.getTime() <= targetStart.getTime())
        .sort((a, b) => b.end.getTime() - a.end.getTime());

      const nearestPreviousEnd = previousSlots[0]?.end;
      const gapMinutes = nearestPreviousEnd
        ? Math.max(
            0,
            Math.floor(
              (targetStart.getTime() - nearestPreviousEnd.getTime()) / 60_000,
            ),
          )
        : Number.MAX_SAFE_INTEGER;

      scores.push({
        staffId,
        scoreGapMinutes: gapMinutes,
        appointmentsCount: busy.length,
      });
    }

    if (scores.length === 0) {
      return {
        professionalId: null,
        reason: "no_available_slot",
        candidatesEvaluated: fullyQualifiedCandidates.length,
      };
    }

    scores.sort((a, b) => {
      if (a.scoreGapMinutes !== b.scoreGapMinutes) {
        return a.scoreGapMinutes - b.scoreGapMinutes;
      }
      return a.appointmentsCount - b.appointmentsCount;
    });

    return {
      professionalId: scores[0].staffId,
      reason: "gap_fill",
      candidatesEvaluated: fullyQualifiedCandidates.length,
    };
  }
}
