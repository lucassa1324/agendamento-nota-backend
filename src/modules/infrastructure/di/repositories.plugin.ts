import { Elysia } from "elysia";
import { DrizzleBusinessRepository } from "../../business/adapters/out/drizzle/business.drizzle.repository";
import { DrizzleAppointmentRepository } from "../../appointments/adapters/out/drizzle/appointment.drizzle.repository";
import { DrizzleServiceRepository } from "../../services/adapters/out/drizzle/service.drizzle.repository";

export const repositoriesPlugin = new Elysia()
  .decorate("businessRepository", new DrizzleBusinessRepository())
  .decorate("appointmentRepository", new DrizzleAppointmentRepository())
  .decorate("serviceRepository", new DrizzleServiceRepository());
