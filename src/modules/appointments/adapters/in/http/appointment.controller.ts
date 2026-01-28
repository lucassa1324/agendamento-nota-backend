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
  .get("/company/:companyId", async ({ params: { companyId }, appointmentRepository, businessRepository, user, set }) => {
    try {
      const listAppointmentsUseCase = new ListAppointmentsUseCase(appointmentRepository, businessRepository);
      return await listAppointmentsUseCase.execute(companyId, user!.id);
    } catch (error: any) {
      set.status = 403;
      return { error: error.message };
    }
  })
  .post("/", async ({ body, appointmentRepository, user, set }) => {
    console.log("\n[APPOINTMENT_CONTROLLER] Recebendo requisição POST /");
    console.log("Body recebido:", JSON.stringify(body, null, 2));
    console.log("Usuário autenticado:", user?.email || "Nenhum");

    try {
      const createAppointmentUseCase = new CreateAppointmentUseCase(appointmentRepository);
      const result = await createAppointmentUseCase.execute({
        ...body,
        customerId: body.customerId || user?.id,
        scheduledAt: new Date(body.scheduledAt),
      });
      return result;
    } catch (error: any) {
      console.error("[APPOINTMENT_CONTROLLER] Erro ao criar agendamento:", error);
      set.status = 400;
      return {
        error: error.message || "Erro interno ao criar agendamento",
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
