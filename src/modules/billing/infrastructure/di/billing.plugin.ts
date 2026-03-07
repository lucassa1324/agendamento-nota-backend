import Elysia from "elysia";
import { AsaasService } from "../../application/services/asaas.service";
import { GenerateBillingUseCase } from "../../application/use-cases/generate-billing.use-case";
import { AsaasIntegration } from "../../adapters/out/asaas/asaas.integration";

const asaasIntegration = new AsaasIntegration();
const billingPort = new AsaasService(asaasIntegration);
const generateBillingUseCase = new GenerateBillingUseCase(billingPort);

export const asaasPlugin = new Elysia({ name: "asaas" }).decorate(
	"asaasIntegration",
	asaasIntegration,
);

export const billingPlugin = new Elysia({ name: "billing" })
	.use(asaasPlugin)
	.decorate("billingPort", billingPort)
	.decorate("generateBillingUseCase", generateBillingUseCase);
