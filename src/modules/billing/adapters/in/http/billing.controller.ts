import { Elysia, t } from "elysia";
import { billingPlugin } from "../../../infrastructure/di/billing.plugin";
import { createBillingDTO } from "../../../domain/DTO/create-billing.dto";

export const billingController = new Elysia({ prefix: "/billing" })
	.use(billingPlugin)
	.post(
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
