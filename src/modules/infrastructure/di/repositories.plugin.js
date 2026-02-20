import { Elysia } from "elysia";
import { DrizzleBusinessRepository } from "../../business/adapters/out/drizzle/business.drizzle.repository";
import { DrizzleAppointmentRepository } from "../../appointments/adapters/out/drizzle/appointment.drizzle.repository";
import { DrizzleServiceRepository } from "../../services/adapters/out/drizzle/service.drizzle.repository";
import { DrizzleInventoryRepository } from "../../inventory/adapters/out/drizzle/inventory.drizzle.repository";
import { DrizzleSettingsRepository } from "../../settings/adapters/out/drizzle/settings.drizzle.repository";
import { DrizzleExpenseRepository } from "../../expenses/adapters/out/drizzle/expense.drizzle.repository";
import { UserRepository } from "../../user/adapters/out/user.repository";
export const repositoriesPlugin = new Elysia()
    .decorate("businessRepository", new DrizzleBusinessRepository())
    .decorate("userRepository", new UserRepository())
    .decorate("appointmentRepository", new DrizzleAppointmentRepository())
    .decorate("serviceRepository", new DrizzleServiceRepository())
    .decorate("inventoryRepository", new DrizzleInventoryRepository())
    .decorate("settingsRepository", new DrizzleSettingsRepository())
    .decorate("expenseRepository", new DrizzleExpenseRepository())
    .decorate("galleryRepository", {})
    .decorate("pushSubscriptionRepository", {});
