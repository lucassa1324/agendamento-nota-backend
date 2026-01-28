import { Elysia, t } from "elysia";
import { authPlugin } from "../../../../infrastructure/auth/auth-plugin";
import { repositoriesPlugin } from "../../../../infrastructure/di/repositories.plugin";
import { ListAppointmentsUseCase } from "../../../application/use-cases/list-appointments.use-case";
import { CreateAppointmentUseCase } from "../../../application/use-cases/create-appointment.use-case";
import { UpdateAppointmentStatusUseCase } from "../../../application/use-cases/update-appointment-status.use-case";
import { DeleteAppointmentUseCase } from "../../../application/use-cases/delete-appointment.use-case";
import { createAppointmentDTO, updateAppointmentStatusDTO } from "../dtos/appointment.dto";

export const appointmentController = new Elysia({ prefix: "/api/appointments" })
  .use(repositoriesPlugin)
  .use(authPlugin)
  .onBeforeHandle(({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }
  })
  .get("/company/:companyId", async ({ params: { companyId }, query, appointmentRepository, businessRepository, user, set }) => {
    try {
      console.log(`[APPOINTMENT_CONTROLLER] Listando agendamentos para empresa: ${companyId}`);
      console.log(`[APPOINTMENT_CONTROLLER] Usuário autenticado: ${user?.id} (${user?.email})`);

      const startDate = query.startDate ? new Date(query.startDate as string) : undefined;
      const endDate = query.endDate ? new Date(query.endDate as string) : undefined;

      // Validação básica de data
      if (query.startDate && isNaN(startDate!.getTime())) {
        set.status = 400;
        return { error: "Invalid startDate format", message: "O formato da data inicial é inválido." };
      }
      if (query.endDate && isNaN(endDate!.getTime())) {
        set.status = 400;
        return { error: "Invalid endDate format", message: "O formato da data final é inválido." };
      }

      const listAppointmentsUseCase = new ListAppointmentsUseCase(appointmentRepository, businessRepository);
      const results = await listAppointmentsUseCase.execute(companyId, user!.id, startDate, endDate);

      return results || [];
    } catch (error: any) {
      console.error("[APPOINTMENT_CONTROLLER] Erro ao listar agendamentos:", error);

      if (error.message.includes("Unauthorized access")) {
        set.status = 403;
        return {
          error: "Forbidden",
          message: "Você não tem permissão para acessar os agendamentos desta empresa."
        };
      }

      set.status = 500;
      return {
        error: "Internal Server Error",
        message: error.message || "Erro ao carregar o calendário."
      };
    }
  })
  .post("/", async ({ body, appointmentRepository, serviceRepository, businessRepository, user, set }) => {
    console.log("\n[APPOINTMENT_CONTROLLER] Recebendo requisição POST /");
    console.log("Body recebido:", JSON.stringify(body, null, 2));
    console.log("Usuário autenticado:", user?.email || "Nenhum");

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

      const createAppointmentUseCase = new CreateAppointmentUseCase(appointmentRepository, serviceRepository, businessRepository);
      const result = await createAppointmentUseCase.execute({
        ...body,
        customerId: body.customerId || user?.id,
        scheduledAt,
      }, user!.id);
      return result;
    } catch (error: any) {
      console.error("[APPOINTMENT_CONTROLLER] Erro ao criar agendamento:", error);

      const errorMessage = error.message || "Erro interno ao criar agendamento";

      if (errorMessage.includes("Unauthorized")) {
        set.status = 403;
        return { error: "Permission denied", message: errorMessage };
      }

      if (errorMessage === "Service not found" || errorMessage === "Service does not belong to this company") {
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
  })
  .patch("/:id/status", async ({ params: { id }, body, appointmentRepository, businessRepository, user, set }) => {
    try {
      const updateAppointmentStatusUseCase = new UpdateAppointmentStatusUseCase(appointmentRepository, businessRepository);
      return await updateAppointmentStatusUseCase.execute(id, body.status, user!.id);
    } catch (error: any) {
      set.status = 403;
      return { error: error.message };
    }
  }, {
    body: updateAppointmentStatusDTO
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
  });
