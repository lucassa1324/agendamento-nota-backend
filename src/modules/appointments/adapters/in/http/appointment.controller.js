import { Elysia, t } from "elysia";
import { authPlugin } from "../../../../infrastructure/auth/auth-plugin";
import { repositoriesPlugin } from "../../../../infrastructure/di/repositories.plugin";
import { ListAppointmentsUseCase } from "../../../application/use-cases/list-appointments.use-case";
import { CreateAppointmentUseCase } from "../../../application/use-cases/create-appointment.use-case";
import { UpdateAppointmentStatusUseCase } from "../../../application/use-cases/update-appointment-status.use-case";
import { DeleteAppointmentUseCase } from "../../../application/use-cases/delete-appointment.use-case";
import { GetOperatingHoursUseCase } from "../../../../business/application/use-cases/get-operating-hours.use-case";
import { createAppointmentDTO, updateAppointmentStatusDTO } from "../dtos/appointment.dto";
export const appointmentController = () => new Elysia({ prefix: "/appointments" })
    .use(repositoriesPlugin)
    .use(authPlugin)
    .onError(({ code, error, set }) => {
    const message = error?.message ?? String(error);
    const detail = error?.errors ?? error?.cause ?? null;
    console.error("APPOINTMENT_CONTROLLER_ERROR", code, message, detail);
})
    // Rotas Públicas
    .group("", (publicGroup) => publicGroup
    .get("/company/:companyId", async ({ params: { companyId }, query, appointmentRepository, businessRepository, set }) => {
    try {
        console.log(`>>> [BACK_PUBLIC_ACCESS] Listando agendamentos (público) para empresa: ${companyId}`);
        const startDateStr = query.startDate;
        const endDateStr = query.endDate;
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
            if (!settings)
                return [];
            const dayIndex = startDate.getUTCDay();
            const dayNames = ["DOMINGO", "SEGUNDA", "TERCA", "QUARTA", "QUINTA", "SEXTA", "SABADO"];
            const dayName = dayNames[dayIndex];
            // Tentar encontrar por índice (0-6) ou por nome (SEGUNDA, etc)
            const dayConfig = settings.weekly.find((w) => String(w.dayOfWeek) === String(dayIndex) ||
                String(w.dayOfWeek).toUpperCase() === dayName);
            if (!dayConfig || dayConfig.status === "CLOSED") {
                return { slots: [], closed: true };
            }
            // Converter intervalo HH:mm para minutos
            const [intH, intM] = settings.interval.split(':').map(Number);
            const intervalMin = (intH * 60) + intM;
            const slots = [];
            const processPeriod = (startStr, endStr) => {
                if (!startStr || !endStr)
                    return;
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
                            }
                            else if (/^\d+$/.test(app.serviceDurationSnapshot)) {
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
                    const isBlocked = settings.blocks.some((block) => {
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
    }
    catch (error) {
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
    .post("/", async ({ body, appointmentRepository, serviceRepository, businessRepository, pushSubscriptionRepository, userRepository, user, set }) => {
    console.log("\n>>> [BACK_PUBLIC_ACCESS] Recebendo agendamento público POST /api/appointments");
    console.log("Body recebido:", JSON.stringify(body, null, 2));
    try {
        const scheduledAt = new Date(body.scheduledAt);
        // Validação de data
        if (isNaN(scheduledAt.getTime())) {
            set.status = 400;
            return {
                error: "Invalid date format",
                message: "A data de agendamento fornecida é inválida. Use o formato ISO (ex: 2025-12-24T10:00:00Z)"
            };
        }
        const createAppointmentUseCase = new CreateAppointmentUseCase(appointmentRepository, serviceRepository, businessRepository, pushSubscriptionRepository, userRepository);
        const result = await createAppointmentUseCase.execute({
            ...body,
            customerId: body.customerId || user?.id,
            scheduledAt,
        }, user?.id); // Passa user?.id (pode ser undefined se público)
        return result;
    }
    catch (error) {
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
        set.status = 500;
        return {
            error: "Internal Server Error",
            message: errorMessage,
            detail: error.detail || error.toString()
        };
    }
}, {
    body: createAppointmentDTO
}))
    // Rotas Privadas
    .group("", (privateGroup) => privateGroup
    .onBeforeHandle(({ user, set }) => {
    if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
    }
})
    .get("/admin/company/:companyId", async ({ params: { companyId }, query, appointmentRepository, businessRepository, user, set }) => {
    try {
        console.log(`>>> [BACK_ADMIN_ACCESS] Listando agendamentos (admin) para empresa: ${companyId}`);
        const startDateStr = query.startDate;
        const endDateStr = query.endDate;
        const startDate = startDateStr ? new Date(startDateStr) : undefined;
        const endDate = endDateStr ? new Date(endDateStr) : undefined;
        console.log(`>>> [FILTRO_DATA] Start: ${startDateStr}, End: ${endDateStr}`);
        const listAppointmentsUseCase = new ListAppointmentsUseCase(appointmentRepository, businessRepository);
        const results = await listAppointmentsUseCase.execute(companyId, user.id, startDate, endDate);
        console.log(`>>> [ADMIN_RESULTS] Encontrados ${results.length} agendamentos`);
        return results || [];
    }
    catch (error) {
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
    .patch("/:id/status", async ({ params: { id }, body, appointmentRepository, businessRepository, userRepository, pushSubscriptionRepository, user, set }) => {
    try {
        const updateAppointmentStatusUseCase = new UpdateAppointmentStatusUseCase(appointmentRepository, businessRepository, userRepository, pushSubscriptionRepository);
        return await updateAppointmentStatusUseCase.execute(id, body.status, user.id);
    }
    catch (error) {
        set.status = 403;
        return { error: error.message };
    }
}, {
    body: updateAppointmentStatusDTO
})
    .delete("/:id", async ({ params: { id }, appointmentRepository, businessRepository, user, set }) => {
    try {
        const deleteAppointmentUseCase = new DeleteAppointmentUseCase(appointmentRepository, businessRepository);
        await deleteAppointmentUseCase.execute(id, user.id);
        return { success: true };
    }
    catch (error) {
        set.status = 403;
        return { error: error.message };
    }
}));
