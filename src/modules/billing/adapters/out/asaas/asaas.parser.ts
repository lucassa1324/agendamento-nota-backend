import type { IPixResponse } from "../../../domain/ports/billing.port";
import type {
	IAsaasCreatePixRequest,
	IAssasCreateBillingResponse,
} from "./asaas.types";
import type { AsaasDateHandler } from "./models/Date";

interface AsaasPixParserParams {
	customerId: string;
	value: number;
	dueDate?: string;
}

export class AsaasPixParser {
	constructor(private readonly dateHandler: AsaasDateHandler) {}

	toProvider(params: AsaasPixParserParams): IAsaasCreatePixRequest {
		return {
			billingType: "PIX",
			customer: params.customerId,
			value: params.value,
			dueDate: params.dueDate || this.dateHandler.getTomorrowFormated(),
		};
	}

	toDomain(params: IAssasCreateBillingResponse): IPixResponse {
		return {
			code: params.pixQrCodeId,
			externalId: params.id,
			invoice: params.invoiceUrl,
		};
	}
}
