import { AsaasDateHandler } from "./models/Date";
import { IPixResponse } from "../../../domain/ports/billing.port";
import { IAsaasCreatePixRequest, IAssasCreatePixResponse } from "./asaas.types";

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

	toDomain(params: IAssasCreatePixResponse): IPixResponse {
		return {
			code: params.pixQrCodeId,
			externalId: params.id,
		};
	}
}
