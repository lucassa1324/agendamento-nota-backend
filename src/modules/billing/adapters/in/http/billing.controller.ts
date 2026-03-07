import { Elysia, t } from "elysia";
import { createBillingDTO } from "../../../domain/DTO/create-billing.dto";
import { billingPlugin } from "../../../infrastructure/di/billing.plugin";

export const billingController = () =>
	new Elysia({ prefix: "/billing" }).use(billingPlugin).post(
		"/",
		async ({ generateBillingUseCase, body }) => {
			const data = await generateBillingUseCase.execute(body);

			return {
				data,
			};
		},
		{
			body: createBillingDTO,
		},
	);
