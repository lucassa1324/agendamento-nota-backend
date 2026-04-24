import { Elysia, t } from "elysia";
import { and, eq, gte, inArray, lte, or, sql } from "drizzle-orm";
import * as schema from "../../../../../db/schema";
import { authPlugin } from "../../../../infrastructure/auth/auth-plugin";
import { db } from "../../../../infrastructure/drizzle/database";
import { repositoriesPlugin } from "../../../../infrastructure/di/repositories.plugin";
import { ListAppointmentsUseCase } from "../../../application/use-cases/list-appointments.use-case";
import { UpdateAppointmentStatusUseCase } from "../../../application/use-cases/update-appointment-status.use-case";
import { DeleteAppointmentUseCase } from "../../../application/use-cases/delete-appointment.use-case";
import { RescheduleAppointmentUseCase } from "../../../application/use-cases/reschedule-appointment.use-case";
import { UpdateAppointmentUseCase } from "../../../application/use-cases/update-appointment.use-case";
import { GetOperatingHoursUseCase } from "../../../../business/application/use-cases/get-operating-hours.use-case";
import { assertNoSchedulingConflict, parseDurationToMinutes } from "../../../application/utils/scheduling-conflict.util";
import { AssignmentEngineService } from "../../../application/services/assignment-engine.service";

const activeAppointmentStatuses = ["PENDING", "CONFIRMED", "ONGOING", "POSTPONED"] as const;

const isMissingCompetencyTableError = (error: unknown) => {
  const code = (error as any)?.code;
  const message = String((error as any)?.message ?? "");
  return code === "42P01" || message.includes("staff_services_competency");
};

const loadStaffSkills = async (staffId: string) => {
  const loadLegacySkills = async () =>
    await db
      .select({ serviceId: schema.staffServices.serviceId })
      .from(schema.staffServices)
      .where(eq(schema.staffServices.staffId, staffId));

  try {
    const competencyRows = await db
      .select({ serviceId: schema.staffServicesCompetency.serviceId })
      .from(schema.staffServicesCompetency)
      .where(
        and(
          eq(schema.staffServicesCompetency.staffId, staffId),
          eq(schema.staffServicesCompetency.isActive, true),
        ),
      );
    // Compatibilidade com configuração legada de serviços por funcionária
    if (competencyRows.length === 0) {
      return await loadLegacySkills();
    }
    return competencyRows;
  } catch (error) {
    if (!isMissingCompetencyTableError(error)) throw error;
    return await loadLegacySkills();
  }
};

const getLocalDayWindow = (date: Date) => {
  const formatter = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const parts = formatter.formatToParts(date);
  const getPart = (type: string) =>
    parts.find((p) => p.type === type)?.value || "00";
  const year = getPart("year");
  const month = getPart("month");
  const day = getPart("day");
  const start = new Date(`${year}-${month}-${day}T00:00:00.000-03:00`);
  const end = new Date(`${year}-${month}-${day}T23:59:59.999-03:00`);
  return { start, end };
};

const assignmentEngine = new AssignmentEngineService();

const autoAssignPendingAppointments = async (params: {
  companyId: string;
  startDate?: Date;
  endDate?: Date;
}) => {
  const filters = [
    eq(schema.appointments.companyId, params.companyId),
    sql`${schema.appointments.staffId} is null`,
    inArray(schema.appointments.status, activeAppointmentStatuses as unknown as string[]),
  ];

  if (params.startDate) {
    filters.push(gte(schema.appointments.scheduledAt, params.startDate));
  }
  if (params.endDate) {
    filters.push(lte(schema.appointments.scheduledAt, params.endDate));
  }

  const pendingRows = await db
    .select({
      id: schema.appointments.id,
      companyId: schema.appointments.companyId,
      customerId: schema.appointments.customerId,
      serviceId: schema.appointments.serviceId,
      serviceDurationSnapshot: schema.appointments.serviceDurationSnapshot,
      scheduledAt: schema.appointments.scheduledAt,
    })
    .from(schema.appointments)
    .where(and(...filters))
    .orderBy(schema.appointments.scheduledAt);

  for (const appointment of pendingRows) {
    const suggestion = await assignmentEngine.suggestProfessional({
      companyId: appointment.companyId,
      serviceIds: [appointment.serviceId],
      scheduledAt: new Date(appointment.scheduledAt),
      durationMinutes: parseDurationToMinutes(appointment.serviceDurationSnapshot),
      customerId: appointment.customerId,
    });

    if (!suggestion.professionalId) continue;

    await db
      .update(schema.appointments)
      .set({
        staffId: suggestion.professionalId,
        assignedBy: "system",
        validationStatus: "suggested",
        version: sql`${schema.appointments.version} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(schema.appointments.id, appointment.id));
  }
};

const redistributeSuggestedAppointments = async (params: {
  companyId: string;
  startDate?: Date;
  endDate?: Date;
}) => {
  const now = new Date();
  const filters = [
    eq(schema.appointments.companyId, params.companyId),
    gte(schema.appointments.scheduledAt, params.startDate ?? now),
    inArray(schema.appointments.status, activeAppointmentStatuses as unknown as string[]),
    or(
      sql`${schema.appointments.staffId} is null`,
      eq(schema.appointments.assignedBy, "system"),
      eq(schema.appointments.validationStatus, "suggested"),
    ),
  ];

  if (params.endDate) {
    filters.push(lte(schema.appointments.scheduledAt, params.endDate));
  }

  const candidateRows = await db
    .select({
      id: schema.appointments.id,
      companyId: schema.appointments.companyId,
      customerId: schema.appointments.customerId,
      serviceId: schema.appointments.serviceId,
      serviceDurationSnapshot: schema.appointments.serviceDurationSnapshot,
      scheduledAt: schema.appointments.scheduledAt,
      staffId: schema.appointments.staffId,
    })
    .from(schema.appointments)
    .where(and(...filters))
    .orderBy(schema.appointments.scheduledAt);

  let reassignedCount = 0;
  let unchangedCount = 0;
  let skippedCount = 0;

  for (const appointment of candidateRows) {
    const suggestion = await assignmentEngine.suggestProfessional({
      companyId: appointment.companyId,
      serviceIds: [appointment.serviceId],
      scheduledAt: new Date(appointment.scheduledAt),
      durationMinutes: parseDurationToMinutes(appointment.serviceDurationSnapshot),
      customerId: appointment.customerId,
    });

    if (!suggestion.professionalId) {
      skippedCount += 1;
      continue;
    }

    const currentStaffId = appointment.staffId ?? null;
    if (currentStaffId === suggestion.professionalId) {
      unchangedCount += 1;
      continue;
    }

    await db
      .update(schema.appointments)
      .set({
        staffId: suggestion.professionalId,
        assignedBy: "system",
        validationStatus: "suggested",
        version: sql`${schema.appointments.version} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(schema.appointments.id, appointment.id));

    reassignedCount += 1;
  }

  return {
    scanned: candidateRows.length,
    reassigned: reassignedCount,
    unchanged: unchangedCount,
    skipped: skippedCount,
  };
};

const getStaffMembership = async (companyId: string, userId: string) => {
  const baseSelect = {
    id: schema.staff.id,
    isActive: schema.staff.isActive,
    isProfessional: schema.staff.isProfessional,
    isSecretary: schema.staff.isSecretary,
    isAdmin: schema.staff.isAdmin,
  };

  const [membershipByUserId] = await db
    .select({
      ...baseSelect,
    })
    .from(schema.staff)
    .where(
      and(
        eq(schema.staff.companyId, companyId),
        eq(schema.staff.userId, userId),
      ),
    )
    .limit(1);

  if (membershipByUserId) return membershipByUserId;

  // Fallback para base legada: vínculo por e-mail sem user_id preenchido
  const [authUser] = await db
    .select({ email: schema.user.email })
    .from(schema.user)
    .where(eq(schema.user.id, userId))
    .limit(1);

  if (!authUser?.email) return null;

  const [membershipByEmail] = await db
    .select({
      ...baseSelect,
    })
    .from(schema.staff)
    .where(
      and(
        eq(schema.staff.companyId, companyId),
        sql`lower(${schema.staff.email}) = lower(${authUser.email})`,
      ),
    )
    .limit(1);

  if (!membershipByEmail) return null;

  // Auto-correção do vínculo para evitar inconsistências futuras
  await db
    .update(schema.staff)
    .set({ userId, updatedAt: new Date() })
    .where(eq(schema.staff.id, membershipByEmail.id));

  return membershipByEmail;
};

const canManageCompanyAppointments = async (
  companyId: string,
  userId: string,
  role?: string,
) => {
  const normalizedRole = role?.toUpperCase();
  if (normalizedRole === "SUPER_ADMIN" || normalizedRole === "ADMIN") {
    return true;
  }

  const [company] = await db
    .select({ ownerId: schema.companies.ownerId })
    .from(schema.companies)
    .where(eq(schema.companies.id, companyId))
    .limit(1);

  if (company?.ownerId === userId) return true;

  const membership = await getStaffMembership(companyId, userId);
  return Boolean(membership?.isActive && (membership.isAdmin || membership.isSecretary));
};

export function appointmentController() {
  return new Elysia({ prefix: "/appointments" })
    .use(repositoriesPlugin)
    .use(authPlugin)
    .onError(({ code, error, set }) => {
      const message = (error as any)?.message ?? String(error);
      const detail = (error as any)?.errors ?? (error as any)?.cause ?? null;
      console.error("APPOINTMENT_CONTROLLER_ERROR", code, message, detail);
    })
    // Rotas Públicas
    .group("", (publicGroup) =>
      publicGroup
        .get("/company/:companyId", async ({ params: { companyId }, query, appointmentRepository, businessRepository, set }) => {
          try {
            console.log(`>>> [BACK_PUBLIC_ACCESS] Listando agendamentos (público) para empresa: ${companyId}`);

            const startDateStr = query.startDate as string;
            const endDateStr = query.endDate as string;

            const startDate = startDateStr ? new Date(startDateStr) : undefined;
            const endDate = endDateStr ? new Date(endDateStr) : undefined;

            // Se for uma requisição de slots (apenas uma data)
            const isSlotRequest = startDateStr && endDateStr && startDateStr.split('T')[0] === endDateStr.split('T')[0];

            const listAppointmentsUseCase = new ListAppointmentsUseCase(appointmentRepository, businessRepository);
            const appointments = await listAppointmentsUseCase.execute(companyId, undefined, startDate, endDate);

            // Se for pedido de slots, gerar a grade de horários disponíveis
            if (isSlotRequest && startDate) {
              console.log(`>>> [SLOT_GENERATION] Gerando slots para ${startDateStr.split('T')[0]}`);

              const settingsUseCase = new GetOperatingHoursUseCase(businessRepository);
              const settings = await settingsUseCase.execute(companyId);

              if (!settings) return [];

              const dayIndex = startDate.getUTCDay();
              const dayNames = ["DOMINGO", "SEGUNDA", "TERCA", "QUARTA", "QUINTA", "SEXTA", "SABADO"];
              const dayName = dayNames[dayIndex];

              // Tentar encontrar por índice (0-6) ou por nome (SEGUNDA, etc)
              const dayConfig = settings.weekly.find((w: any) =>
                String(w.dayOfWeek) === String(dayIndex) ||
                String(w.dayOfWeek).toUpperCase() === dayName
              );

              if (!dayConfig || dayConfig.status === "CLOSED") {
                return { slots: [], closed: true };
              }

              // Converter intervalo HH:mm para minutos
              const [intH, intM] = settings.interval.split(':').map(Number);
              const intervalMin = (intH * 60) + intM;

              const slots: any[] = [];

              const processPeriod = (startStr: string | null | undefined, endStr: string | null | undefined) => {
                if (!startStr || !endStr) return;

                const [sH, sM] = startStr.split(':').map(Number);
                const [eH, eM] = endStr.split(':').map(Number);

                let currentTotalMin = (sH * 60) + sM;
                const endTotalMin = (eH * 60) + eM;

                while (currentTotalMin + intervalMin <= endTotalMin) {
                  const h = Math.floor(currentTotalMin / 60);
                  const m = currentTotalMin % 60;
                  const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

                  // Verificar se o horário está ocupado por um agendamento (considerando duração)
                  const isOccupied = appointments.some(app => {
                    const appDate = new Date(app.scheduledAt);
                    // Usar o horário local para comparação com o expediente (HH:mm)
                    const appH = appDate.getHours();
                    const appM = appDate.getMinutes();

                    const appStartTotalMin = (appH * 60) + appM;

                    // Pegar duração do snapshot (formato HH:mm ou minutos)
                    let durationMin = 30; // default
                    if (app.serviceDurationSnapshot) {
                      if (app.serviceDurationSnapshot.includes(':')) {
                        const [dH, dM] = app.serviceDurationSnapshot.split(':').map(Number);
                        durationMin = (dH * 60) + dM;
                      } else if (/^\d+$/.test(app.serviceDurationSnapshot)) {
                        durationMin = parseInt(app.serviceDurationSnapshot);
                      }
                    }

                    const appEndTotalMin = appStartTotalMin + durationMin;

                    // O slot está ocupado se o seu início estiver dentro do intervalo do agendamento
                    // ou se o agendamento começar durante este slot
                    return app.status !== 'CANCELLED' &&
                      currentTotalMin >= appStartTotalMin &&
                      currentTotalMin < appEndTotalMin;
                  });

                  // Verificar bloqueios de agenda
                  const isBlocked = settings.blocks.some((block: any) => {
                    const blockStart = block.startTime || "00:00";
                    const blockEnd = block.endTime || "23:59";
                    return timeStr >= blockStart && timeStr < blockEnd;
                  });

                  slots.push({
                    time: timeStr,
                    available: !isOccupied && !isBlocked,
                    reason: isOccupied ? 'OCCUPIED' : (isBlocked ? 'BLOCKED' : null)
                  });

                  currentTotalMin += intervalMin;
                }
              };

              processPeriod(dayConfig.morningStart, dayConfig.morningEnd);
              processPeriod(dayConfig.afternoonStart, dayConfig.afternoonEnd);

              return {
                date: startDateStr.split('T')[0],
                interval: settings.interval,
                slots
              };
            }

            // Sanitização padrão para listagem de agendamentos
            return appointments.map(app => ({
              id: app.id,
              scheduledAt: app.scheduledAt,
              status: app.status,
              serviceId: app.serviceId,
              duration: app.serviceDurationSnapshot,
            }));
          } catch (error: any) {
            set.status = 500;
            return { error: "Internal Server Error", message: error.message };
          }
        }, {
          params: t.Object({ companyId: t.String() }),
          query: t.Object({
            startDate: t.Optional(t.String()),
            endDate: t.Optional(t.String())
          })
        })
        .post("/", async ({ body, headers, appointmentRepository, serviceRepository, businessRepository, pushSubscriptionRepository, userRepository, user, set }) => {
          console.log("\n>>> [BACK_PUBLIC_ACCESS] Recebendo agendamento público POST /api/appointments");
          console.log("Dados recebidos:", JSON.stringify(body));

          try {
            // Lazy load CreateAppointmentUseCase to avoid circular initialization
            const { CreateAppointmentUseCase } = await import("../../../application/use-cases/create-appointment.use-case");

            let companyId = body.companyId;

            // Tentativa de resolver companyId pelo slug se não vier no body
            if (!companyId) {
              const businessSlug = headers['x-business-slug'];
              if (businessSlug) {
                console.log(`[APPOINTMENT_CONTROLLER] Buscando empresa pelo slug: ${businessSlug}`);
                const business = await businessRepository.findBySlug(businessSlug);
                if (business) {
                  companyId = business.id;
                  console.log(`[APPOINTMENT_CONTROLLER] Empresa encontrada: ${companyId}`);
                }
              }
            }

            if (!companyId) {
              set.status = 400;
              return { error: "Validation error", message: "Company ID is required" };
            }

            const scheduledAt = new Date(body.scheduledAt);

            // Validação de data
            if (isNaN(scheduledAt.getTime())) {
              set.status = 400;
              return {
                error: "Invalid date format",
                message: "A data de agendamento fornecida é inválida. Use o formato ISO (ex: 2025-12-24T10:00:00Z)"
              };
            }

            const createAppointmentUseCase = new CreateAppointmentUseCase(
              appointmentRepository,
              serviceRepository,
              businessRepository,
              pushSubscriptionRepository,
              userRepository
            );

            const result = await createAppointmentUseCase.execute({
              ...body,
              companyId, // Garante que usa o ID resolvido
              customerId: body.customerId || user?.id,
              scheduledAt,
              autoAssign: body.auto_assign,
              forceStaffId: body.force_staff_id,
              staffId: body.force_staff_id ?? body.staffId,
            }, user?.id); // Passa user?.id (pode ser undefined se público)

            return result;
          } catch (error: any) {
            console.error("[APPOINTMENT_CONTROLLER] Erro ao criar agendamento:", error);

            const errorMessage = error.message || "Erro interno ao criar agendamento";

            if (errorMessage.includes("Unauthorized")) {
              set.status = 403;
              return { error: "Permission denied", message: errorMessage };
            }

            if (errorMessage.includes("Service") || errorMessage.includes("not available")) {
              set.status = 400;
              return { error: "Validation error", message: errorMessage };
            }

            if (errorMessage.includes("Business not found")) {
              set.status = 404;
              return { error: "Not Found", message: errorMessage };
            }

            if (errorMessage.includes("ANTI_ABUSE:")) {
              set.status = 400;
              return {
                error: "Validation error",
                message: errorMessage.replace("ANTI_ABUSE:", "").trim(),
              };
            }

            // Erros de regra de negócio (horário, conflito, etc)
            if (
              errorMessage.includes("exceed business hours") ||
              errorMessage.includes("closed on this day") ||
              errorMessage.includes("already occupied") ||
              errorMessage.includes("operating hours not configured") ||
              errorMessage.includes("horário passado")
            ) {
              set.status = 400;
              return { error: "Scheduling Error", message: errorMessage };
            }

            set.status = 500;
            return {
              error: "Internal Server Error",
              message: errorMessage,
              detail: error.detail || error.toString()
            };
          }
        }, {
          body: t.Object({
            companyId: t.Optional(t.String()), // Agora é opcional no schema, pois pode vir pelo slug
            serviceId: t.String(),
            customerId: t.Optional(t.Nullable(t.String())),
            scheduledAt: t.String(),
            customerName: t.String(),
            customerEmail: t.String(),
            customerPhone: t.String(),
            serviceNameSnapshot: t.String(),
            servicePriceSnapshot: t.String(),
            serviceDurationSnapshot: t.String(),
            staffId: t.Optional(t.Nullable(t.String())),
            force_staff_id: t.Optional(t.Nullable(t.String())),
            auto_assign: t.Optional(t.Boolean()),
            force: t.Optional(t.Boolean()),
            notes: t.Optional(t.String()),
            ignoreBusinessHoursValidation: t.Optional(t.Boolean()),
            items: t.Optional(t.Array(t.Object({
              serviceId: t.String(),
              serviceNameSnapshot: t.String(),
              servicePriceSnapshot: t.String(),
              serviceDurationSnapshot: t.String(),
            }))),
          })
        })
    )
    // Rotas Privadas
    .group("", (privateGroup) =>
      privateGroup
        .onBeforeHandle(({ user, set }) => {
          if (!user) {
            set.status = 401;
            return { error: "Unauthorized" };
          }
        })
        .get("/admin/company/:companyId", async ({ params: { companyId }, query, appointmentRepository, businessRepository, user, set }) => {
          try {
            console.log(`>>> [BACK_ADMIN_ACCESS] Listando agendamentos (admin) para empresa: ${companyId}`);

            const startDateStr = query.startDate as string;
            const endDateStr = query.endDate as string;

            const startDate = startDateStr ? new Date(startDateStr) : undefined;
            const endDate = endDateStr ? new Date(endDateStr) : undefined;

            console.log(`>>> [FILTRO_DATA] Start: ${startDateStr}, End: ${endDateStr}`);

            // Garantia de persistência: pendências elegíveis são autoatribuídas
            // antes de responder o calendário/lista.
            await autoAssignPendingAppointments({
              companyId,
              startDate,
              endDate,
            });

            const listAppointmentsUseCase = new ListAppointmentsUseCase(appointmentRepository, businessRepository);
            const results = await listAppointmentsUseCase.execute(companyId, user!.id, startDate, endDate);

            console.log(`>>> [ADMIN_RESULTS] Encontrados ${results.length} agendamentos`);

            if (!results || results.length === 0) return [];

            // Fallback robusto: em bases legadas/instâncias antigas o repositório
            // pode não projetar staffId. Aqui garantimos o staffId persistido por ID.
            const appointmentIds = results.map((appointment) => appointment.id);
            const persistedRows = await db
              .select({
                id: schema.appointments.id,
                staffId: schema.appointments.staffId,
                assignedBy: schema.appointments.assignedBy,
                validationStatus: schema.appointments.validationStatus,
                version: schema.appointments.version,
              })
              .from(schema.appointments)
              .where(inArray(schema.appointments.id, appointmentIds));

            const persistedById = new Map(
              persistedRows.map((row) => [row.id, row]),
            );

            const normalizedResults = results.map((appointment) => {
              const persisted = persistedById.get(appointment.id);
              return {
                ...appointment,
                staffId: appointment.staffId ?? persisted?.staffId ?? null,
                assignedBy: appointment.assignedBy ?? persisted?.assignedBy ?? "staff",
                validationStatus:
                  appointment.validationStatus ?? persisted?.validationStatus ?? "confirmed",
                version: appointment.version ?? persisted?.version ?? 1,
              };
            });

            const assignedIds = Array.from(
              new Set(
                normalizedResults
                  .map((appointment) =>
                    typeof appointment.staffId === "string"
                      ? appointment.staffId.trim()
                      : "",
                  )
                  .filter((id) => id.length > 0),
              ),
            );

            if (assignedIds.length === 0) return normalizedResults;

            const staffRows = await db
              .select({
                id: schema.staff.id,
                userId: schema.staff.userId,
                name: schema.staff.name,
                calendarColor: schema.staff.calendarColor,
              })
              .from(schema.staff)
              .where(
                and(
                  eq(schema.staff.companyId, companyId),
                  or(
                    inArray(schema.staff.id, assignedIds),
                    inArray(schema.staff.userId, assignedIds),
                  ),
                ),
              );

            const colorByStaffRef = new Map<string, string>();
            const nameByStaffRef = new Map<string, string>();
            const staffIdByRef = new Map<string, string>();
            for (const member of staffRows) {
              if (member.id) {
                colorByStaffRef.set(member.id, member.calendarColor ?? "");
                nameByStaffRef.set(member.id, member.name);
                staffIdByRef.set(member.id, member.id);
              }
              if (member.userId) {
                colorByStaffRef.set(member.userId, member.calendarColor ?? "");
                nameByStaffRef.set(member.userId, member.name);
                staffIdByRef.set(member.userId, member.id);
              }
            }

            return normalizedResults.map((appointment) => {
              const appointmentStaffId =
                typeof appointment.staffId === "string"
                  ? appointment.staffId.trim()
                  : "";
              const resolvedColor =
                appointmentStaffId.length > 0
                  ? colorByStaffRef.get(appointmentStaffId) ?? null
                  : null;
              const resolvedName =
                appointmentStaffId.length > 0
                  ? nameByStaffRef.get(appointmentStaffId) ?? null
                  : null;
              const resolvedStaffId =
                appointmentStaffId.length > 0
                  ? staffIdByRef.get(appointmentStaffId) ?? null
                  : null;

              return {
                ...appointment,
                calendarColor: resolvedColor,
                assignedStaffName: resolvedName,
                assignedStaff:
                  resolvedStaffId && resolvedName
                    ? {
                      id: resolvedStaffId,
                      name: resolvedName,
                      calendarColor: resolvedColor,
                    }
                    : null,
              };
            });
          } catch (error: any) {
            console.error(`>>> [ADMIN_ERROR]`, error.message);
            set.status = error.message.includes("Unauthorized access") ? 403 : 500;
            return { error: error.message };
          }
        }, {
          params: t.Object({ companyId: t.String() }),
          query: t.Object({
            startDate: t.Optional(t.String()),
            endDate: t.Optional(t.String())
          })
        })
        .post("/admin/company/:companyId/redistribute", async ({ params: { companyId }, body, user, set }) => {
          const isAllowed = await canManageCompanyAppointments(companyId, user!.id, user?.role);
          if (!isAllowed) {
            set.status = 403;
            return { error: "Forbidden" };
          }

          const startDate = body.startDate ? new Date(body.startDate) : undefined;
          const endDate = body.endDate ? new Date(body.endDate) : undefined;

          if (startDate && Number.isNaN(startDate.getTime())) {
            set.status = 400;
            return { error: "Data inicial inválida." };
          }
          if (endDate && Number.isNaN(endDate.getTime())) {
            set.status = 400;
            return { error: "Data final inválida." };
          }
          if (startDate && endDate && startDate.getTime() > endDate.getTime()) {
            set.status = 400;
            return { error: "Intervalo inválido: data inicial maior que data final." };
          }

          const summary = await redistributeSuggestedAppointments({
            companyId,
            startDate,
            endDate,
          });

          return {
            success: true,
            summary,
          };
        }, {
          params: t.Object({ companyId: t.String() }),
          body: t.Object({
            startDate: t.Optional(t.String()),
            endDate: t.Optional(t.String()),
          }),
        })
        .get("/admin/company/:companyId/unassigned", async ({ params: { companyId }, user, set }) => {
          const isAllowed = await canManageCompanyAppointments(companyId, user!.id, user?.role);
          if (!isAllowed) {
            set.status = 403;
            return { error: "Forbidden" };
          }

          await autoAssignPendingAppointments({ companyId });

          const rows = await db
            .select()
            .from(schema.appointments)
            .where(
              and(
                eq(schema.appointments.companyId, companyId),
                sql`${schema.appointments.staffId} is null`,
                inArray(schema.appointments.status, activeAppointmentStatuses as unknown as string[]),
              ),
            )
            .orderBy(schema.appointments.scheduledAt);

          return rows;
        }, {
          params: t.Object({ companyId: t.String() }),
        })
        .get("/my/company/:companyId/daily", async ({ params: { companyId }, query, user, set }) => {
          const membership = await getStaffMembership(companyId, user!.id);
          if (!membership?.isActive) {
            set.status = 403;
            return { error: "Sua conta não está vinculada a um colaborador ativo nessa empresa." };
          }

          const baseDate = query.date ? new Date(query.date) : new Date();
          if (Number.isNaN(baseDate.getTime())) {
            set.status = 400;
            return { error: "Data inválida." };
          }

          const { start, end } = getLocalDayWindow(baseDate);
          const rows = await db
            .select()
            .from(schema.appointments)
            .where(
              and(
                eq(schema.appointments.companyId, companyId),
                eq(schema.appointments.staffId, membership.id),
                gte(schema.appointments.scheduledAt, start),
                lte(schema.appointments.scheduledAt, end),
                inArray(schema.appointments.status, activeAppointmentStatuses as unknown as string[]),
              ),
            )
            .orderBy(schema.appointments.scheduledAt);

          return rows;
        }, {
          params: t.Object({ companyId: t.String() }),
          query: t.Object({ date: t.Optional(t.String()) }),
        })
        .get("/my/company/:companyId/opportunities", async ({ params: { companyId }, user, set }) => {
          const membership = await getStaffMembership(companyId, user!.id);
          if (!membership?.isActive || !membership.isProfessional) {
            set.status = 403;
            return { error: "Somente profissionais ativos podem acessar oportunidades." };
          }

          const skillRows = await loadStaffSkills(membership.id);
          const serviceIds = skillRows.map((skill) => skill.serviceId);

          if (serviceIds.length === 0) return [];

          const opportunities = await db
            .select()
            .from(schema.appointments)
            .where(
              and(
                eq(schema.appointments.companyId, companyId),
                sql`${schema.appointments.staffId} is null`,
                inArray(schema.appointments.serviceId, serviceIds),
                inArray(schema.appointments.status, activeAppointmentStatuses as unknown as string[]),
              ),
            )
            .orderBy(schema.appointments.scheduledAt);

          return opportunities;
        }, {
          params: t.Object({ companyId: t.String() }),
        })
        .patch("/:id/assignment", async ({ params: { id }, body, user, set }) => {
          const appointment = await db
            .select()
            .from(schema.appointments)
            .where(eq(schema.appointments.id, id))
            .limit(1)
            .then((rows) => rows[0]);

          if (!appointment) {
            set.status = 404;
            return { error: "Agendamento não encontrado." };
          }

          const isAllowed = await canManageCompanyAppointments(
            appointment.companyId,
            user!.id,
            user?.role,
          );
          if (!isAllowed) {
            set.status = 403;
            return { error: "Forbidden" };
          }

          const nextScheduledAt = body.scheduledAt
            ? new Date(body.scheduledAt)
            : new Date(appointment.scheduledAt);
          if (Number.isNaN(nextScheduledAt.getTime())) {
            set.status = 400;
            return { error: "Data de agendamento inválida." };
          }

          const nextStaffId =
            body.professionalId === undefined
              ? appointment.staffId
              : body.professionalId || null;

          if (
            typeof body.expectedVersion === "number" &&
            appointment.version !== body.expectedVersion
          ) {
            set.status = 409;
            return {
              error: "Version conflict",
              message:
                "Esse agendamento foi alterado por outra pessoa. Atualize a tela e tente novamente.",
            };
          }

          if (nextStaffId) {
            const { start, end } = getLocalDayWindow(nextScheduledAt);
            const existingAppointments = await db
              .select()
              .from(schema.appointments)
              .where(
                and(
                  eq(schema.appointments.companyId, appointment.companyId),
                  eq(schema.appointments.staffId, nextStaffId),
                  gte(schema.appointments.scheduledAt, start),
                  lte(schema.appointments.scheduledAt, end),
                ),
              );

            const blocks = await db
              .select({
                startTime: schema.scheduleBlocks.startTime,
                endTime: schema.scheduleBlocks.endTime,
                isOverrideable: schema.scheduleBlocks.isOverrideable,
              })
              .from(schema.scheduleBlocks)
              .where(eq(schema.scheduleBlocks.staffId, nextStaffId));

            assertNoSchedulingConflict({
              scheduledAt: nextScheduledAt,
              durationMinutes: parseDurationToMinutes(
                appointment.serviceDurationSnapshot,
              ),
              existingAppointments: existingAppointments as any,
              scheduleBlocks: blocks.map((block) => ({
                startTime: new Date(block.startTime),
                endTime: new Date(block.endTime),
                isOverrideable: block.isOverrideable,
              })),
              currentAppointmentId: appointment.id,
              force: true,
            });
          }

          const updateWhere =
            typeof body.expectedVersion === "number"
              ? and(
                eq(schema.appointments.id, appointment.id),
                eq(schema.appointments.version, body.expectedVersion),
              )
              : eq(schema.appointments.id, appointment.id);

          const updated = await db
            .update(schema.appointments)
            .set({
              staffId: nextStaffId ?? null,
              scheduledAt: nextScheduledAt,
              assignedBy: "staff",
              validationStatus: "confirmed",
              version: sql`${schema.appointments.version} + 1`,
              updatedAt: new Date(),
            })
            .where(updateWhere)
            .returning();

          if (!updated[0]) {
            set.status = 409;
            return {
              error: "Version conflict",
              message:
                "Esse agendamento foi alterado por outra pessoa. Atualize a tela e tente novamente.",
            };
          }

          return updated[0];
        }, {
          body: t.Object({
            professionalId: t.Optional(t.Nullable(t.String())),
            scheduledAt: t.Optional(t.String()),
            expectedVersion: t.Optional(t.Number()),
          }),
        })
        .post("/:id/claim", async ({ params: { id }, body, user, set }) => {
          const membership = await getStaffMembership(body.companyId, user!.id);
          if (!membership?.isActive || !membership.isProfessional) {
            set.status = 403;
            return { error: "Somente profissionais ativos podem assumir serviços." };
          }

          const appointment = await db
            .select()
            .from(schema.appointments)
            .where(
              and(
                eq(schema.appointments.id, id),
                eq(schema.appointments.companyId, body.companyId),
              ),
            )
            .limit(1)
            .then((rows) => rows[0]);

          if (!appointment) {
            set.status = 404;
            return { error: "Agendamento não encontrado." };
          }

          if (appointment.staffId) {
            set.status = 409;
            return { error: "Este serviço já foi assumido por outro profissional." };
          }

          const skillRows = await loadStaffSkills(membership.id);
          const skills = new Set(skillRows.map((skill) => skill.serviceId));

          if (!skills.has(appointment.serviceId)) {
            set.status = 403;
            return { error: "Você não possui skill para este serviço." };
          }

          const start = new Date(appointment.scheduledAt);
          const { start: dayStart, end: dayEnd } = getLocalDayWindow(start);
          const existingAppointments = await db
            .select()
            .from(schema.appointments)
            .where(
              and(
                eq(schema.appointments.companyId, appointment.companyId),
                eq(schema.appointments.staffId, membership.id),
                gte(schema.appointments.scheduledAt, dayStart),
                lte(schema.appointments.scheduledAt, dayEnd),
              ),
            );

          assertNoSchedulingConflict({
            scheduledAt: start,
            durationMinutes: parseDurationToMinutes(appointment.serviceDurationSnapshot),
            existingAppointments: existingAppointments as any,
            currentAppointmentId: appointment.id,
          });

          const updated = await db
            .update(schema.appointments)
            .set({
              staffId: membership.id,
              assignedBy: "staff",
              validationStatus: "confirmed",
              version: sql`${schema.appointments.version} + 1`,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(schema.appointments.id, appointment.id),
                eq(schema.appointments.version, body.expectedVersion),
              ),
            )
            .returning();

          if (!updated[0]) {
            set.status = 409;
            return {
              error: "Version conflict",
              message:
                "Esse serviço foi alterado antes da confirmação. Atualize a lista e tente novamente.",
            };
          }

          return updated[0];
        }, {
          body: t.Object({
            companyId: t.String(),
            expectedVersion: t.Number(),
          }),
        })
        .patch("/:id/schedule", async ({ params: { id }, body, appointmentRepository, businessRepository, user, set }) => {
          try {
            const scheduledAt = new Date(body.scheduledAt);
            if (isNaN(scheduledAt.getTime())) {
              set.status = 400;
              return {
                error: "Validation error",
                message: "Data/hora inválida para reagendamento.",
              };
            }

            const useCase = new RescheduleAppointmentUseCase(
              appointmentRepository,
              businessRepository,
            );
            return await useCase.execute(id, scheduledAt, user!.id, Boolean(body.force));
          } catch (error: any) {
            const message = error?.message || "Erro ao reagendar agendamento";
            if (message.includes("Unauthorized")) {
              set.status = 403;
            } else if (
              message.includes("not found") ||
              message.includes("cancelado") ||
              message.includes("ocupado")
            ) {
              set.status = 400;
            } else {
              set.status = 500;
            }
            return { error: "Reschedule error", message };
          }
        }, {
          body: t.Object({
            scheduledAt: t.String(),
            force: t.Optional(t.Boolean()),
          })
        })
        .patch("/:id", async ({ params: { id }, body, appointmentRepository, serviceRepository, businessRepository, user, set }) => {
          try {
            const scheduledAt = new Date(body.scheduledAt);
            if (isNaN(scheduledAt.getTime())) {
              set.status = 400;
              return { error: "Validation error", message: "Data/hora inválida para edição." };
            }

            const useCase = new UpdateAppointmentUseCase(
              appointmentRepository,
              serviceRepository,
              businessRepository,
            );

            return await useCase.execute(
              {
                id,
                scheduledAt,
                customerName: body.customerName,
                customerEmail: body.customerEmail,
                customerPhone: body.customerPhone,
                serviceId: body.serviceId,
                servicePriceSnapshot: body.servicePriceSnapshot,
                staffId: body.staffId,
                force: body.force,
                notes: body.notes,
                ignoreBusinessHoursValidation: body.ignoreBusinessHoursValidation,
              },
              user!.id,
            );
          } catch (error: any) {
            const message = error?.message || "Erro ao editar agendamento";
            if (message.includes("Unauthorized")) {
              set.status = 403;
            } else if (
              message.includes("not found") ||
              message.includes("ocupado") ||
              message.includes("horário de funcionamento") ||
              message.includes("closed")
            ) {
              set.status = 400;
            } else {
              set.status = 500;
            }
            return { error: "Update error", message };
          }
        }, {
          body: t.Object({
            scheduledAt: t.String(),
            customerName: t.String(),
            customerEmail: t.String(),
            customerPhone: t.String(),
            serviceId: t.String(),
            servicePriceSnapshot: t.String(),
            staffId: t.Optional(t.Nullable(t.String())),
            force: t.Optional(t.Boolean()),
            notes: t.Optional(t.String()),
            ignoreBusinessHoursValidation: t.Optional(t.Boolean()),
          })
        })
        .patch("/:id/status", async ({ params: { id }, body, appointmentRepository, businessRepository, userRepository, pushSubscriptionRepository, user, set }) => {
          try {
            const updateAppointmentStatusUseCase = new UpdateAppointmentStatusUseCase(
              appointmentRepository,
              businessRepository,
              userRepository,
              pushSubscriptionRepository
            );
            return await updateAppointmentStatusUseCase.execute(id, body.status, user!.id);
          } catch (error: any) {
            set.status = 403;
            return { error: error.message };
          }
        }, {
          body: t.Object({
            status: t.Enum({
              PENDING: "PENDING",
              CONFIRMED: "CONFIRMED",
              COMPLETED: "COMPLETED",
              ONGOING: "ONGOING",
              CANCELLED: "CANCELLED",
              POSTPONED: "POSTPONED"
            } as const),
          })
        })
        .delete("/:id", async ({ params: { id }, appointmentRepository, businessRepository, user, set }) => {
          try {
            const deleteAppointmentUseCase = new DeleteAppointmentUseCase(appointmentRepository, businessRepository);
            await deleteAppointmentUseCase.execute(id, user!.id);
            return { success: true };
          } catch (error: any) {
            set.status = 403;
            return { error: error.message };
          }
        })
    );
}
