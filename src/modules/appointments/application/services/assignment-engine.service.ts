import { and, eq, gte, inArray, lte, ne } from "drizzle-orm";
import * as schema from "../../../../db/schema";
import { db } from "../../../infrastructure/drizzle/database";
import { parseDurationToMinutes } from "../utils/scheduling-conflict.util";

type SuggestAssignmentInput = {
  companyId: string;
  serviceIds: string[];
  scheduledAt: Date;
  durationMinutes: number;
  customerId?: string | null;
  ignoreAppointmentId?: string;
  tx?: any;
};

type CandidateScore = {
  staffId: string;
  priorityScore: number;
  totalScore: number;
  scoreGapMinutes: number;
  workloadMinutes: number;
  appointmentCount: number;
  hasAffinity: boolean;
};

type AssignmentSuggestion = {
  professionalId: string | null;
  reason: "gap_fill" | "no_candidate" | "no_available_slot";
  candidatesEvaluated: number;
};

const isMissingCompetencyTableError = (error: unknown) => {
  const code = (error as any)?.code;
  const message = String((error as any)?.message ?? "");
  return code === "42P01" || message.includes("staff_services_competency");
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
    const conn = input.tx ?? db;

    if (input.serviceIds.length === 0) {
      return {
        professionalId: null,
        reason: "no_candidate",
        candidatesEvaluated: 0,
      };
    }

    const loadLegacyStaffRows = async () =>
      await conn
        .select({
          staffId: schema.staff.id,
          serviceId: schema.staffServices.serviceId,
          priorityScore: schema.staff.commissionRate,
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

    let candidateRows: Array<{
      staffId: string;
      serviceId: string;
      priorityScore: number;
    }> = [];
    try {
      candidateRows = await conn
        .select({
          staffId: schema.staff.id,
          serviceId: schema.staffServicesCompetency.serviceId,
          priorityScore: schema.staffServicesCompetency.priorityScore,
        })
        .from(schema.staff)
        .innerJoin(
          schema.staffServicesCompetency,
          eq(schema.staffServicesCompetency.staffId, schema.staff.id),
        )
        .where(
          and(
            eq(schema.staff.companyId, input.companyId),
            eq(schema.staff.isActive, true),
            eq(schema.staff.isProfessional, true),
            eq(schema.staffServicesCompetency.isActive, true),
            inArray(schema.staffServicesCompetency.serviceId, input.serviceIds),
          ),
        );
      // Compatibilidade: se a tabela nova existir, mas ainda sem dados,
      // usa as configurações legadas de serviços por funcionária.
      if (candidateRows.length === 0) {
        candidateRows = await loadLegacyStaffRows();
      }
    } catch (error) {
      if (!isMissingCompetencyTableError(error)) throw error;
      candidateRows = await loadLegacyStaffRows();
    }

    if (candidateRows.length === 0) {
      return {
        professionalId: null,
        reason: "no_candidate",
        candidatesEvaluated: 0,
      };
    }

    const serviceSet = new Set(input.serviceIds);
    const candidateSkillMap = new Map<
      string,
      { skills: Set<string>; priorityScore: number }
    >();
    for (const row of candidateRows) {
      const current = candidateSkillMap.get(row.staffId) || {
        skills: new Set<string>(),
        priorityScore: 0,
      };
      current.skills.add(row.serviceId);
      current.priorityScore = Math.max(
        current.priorityScore,
        Number(row.priorityScore ?? 0),
      );
      candidateSkillMap.set(row.staffId, current);
    }

    const fullyQualifiedCandidates = Array.from(candidateSkillMap.entries())
      .filter(([, candidate]) => {
        for (const requiredServiceId of serviceSet) {
          if (!candidate.skills.has(requiredServiceId)) return false;
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

    const appointments = await conn
      .select({
        id: schema.appointments.id,
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
          input.ignoreAppointmentId
            ? ne(schema.appointments.id, input.ignoreAppointmentId)
            : undefined,
        ),
      );

    const affinityByStaff = new Map<string, boolean>();
    if (input.customerId) {
      const sixMonthsAgo = new Date(input.scheduledAt);
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const affinityRows = await conn
        .select({
          staffId: schema.appointments.staffId,
        })
        .from(schema.appointments)
        .where(
          and(
            eq(schema.appointments.companyId, input.companyId),
            eq(schema.appointments.customerId, input.customerId),
            inArray(schema.appointments.staffId, fullyQualifiedCandidates),
            gte(schema.appointments.scheduledAt, sixMonthsAgo),
            lte(schema.appointments.scheduledAt, input.scheduledAt),
            input.ignoreAppointmentId
              ? ne(schema.appointments.id, input.ignoreAppointmentId)
              : undefined,
          ),
        );

      for (const row of affinityRows) {
        if (row.staffId) affinityByStaff.set(row.staffId, true);
      }
    }

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

      const workloadMinutes = busy.reduce((acc, slot) => {
        const durationMin = Math.max(
          0,
          Math.floor((slot.end.getTime() - slot.start.getTime()) / 60_000),
        );
        return acc + durationMin;
      }, 0);
      const candidatePriority =
        candidateSkillMap.get(staffId)?.priorityScore ?? 0;
      const hasAffinity = affinityByStaff.get(staffId) ?? false;

      scores.push({
        staffId,
        priorityScore: candidatePriority,
        totalScore: 0,
        scoreGapMinutes: gapMinutes,
        workloadMinutes,
        appointmentCount: busy.length,
        hasAffinity,
      });
    }

    if (scores.length === 0) {
      return {
        professionalId: null,
        reason: "no_available_slot",
        candidatesEvaluated: fullyQualifiedCandidates.length,
      };
    }

    const finiteGaps = scores
      .map((candidate) => candidate.scoreGapMinutes)
      .filter((gap) => Number.isFinite(gap));
    const maxGap = finiteGaps.length > 0 ? Math.max(...finiteGaps) : 0;
    const maxWorkload = Math.max(
      ...scores.map((candidate) => candidate.workloadMinutes),
      0,
    );

    for (const candidate of scores) {
      const normalizedGap =
        candidate.scoreGapMinutes === Number.MAX_SAFE_INTEGER
          ? 1
          : maxGap > 0
            ? candidate.scoreGapMinutes / maxGap
            : 0;
      const normalizedLoad =
        maxWorkload > 0 ? candidate.workloadMinutes / maxWorkload : 0;
      const affinityPenalty = candidate.hasAffinity ? 0 : 1;

      candidate.totalScore =
        normalizedGap * 0.6 + normalizedLoad * 0.3 + affinityPenalty * 0.1;
    }

    scores.sort((a, b) => {
      if (a.appointmentCount !== b.appointmentCount) {
        return a.appointmentCount - b.appointmentCount;
      }
      if (a.workloadMinutes !== b.workloadMinutes) {
        return a.workloadMinutes - b.workloadMinutes;
      }
      if (a.totalScore !== b.totalScore) {
        return a.totalScore - b.totalScore;
      }
      if (a.priorityScore !== b.priorityScore) {
        return b.priorityScore - a.priorityScore;
      }
      return a.staffId.localeCompare(b.staffId);
    });

    return {
      professionalId: scores[0].staffId,
      reason: "gap_fill",
      candidatesEvaluated: fullyQualifiedCandidates.length,
    };
  }
}
