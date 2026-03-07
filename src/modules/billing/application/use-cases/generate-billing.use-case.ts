import type { CreateBillingDTO } from "../../domain/DTO/create-billing.dto";
import {
	IBillingPort,
	ICardResponse,
	IPixResponse,
	ISlipResponse,
} from "../../domain/ports/billing.port";

export class GenerateBillingUseCase {
	constructor(private readonly billingPort: IBillingPort) {}

	async execute(
		data: CreateBillingDTO,
	): Promise<IPixResponse | ISlipResponse | ICardResponse | undefined> {
		switch (data.billingType) {
			case "PIX":
				return await this.billingPort.generatePixBilling(data);

			case "SLIP":
				return await this.billingPort.generateBankSlipBilling(data);

			case "CARD":
				return await this.billingPort.generateCreditCardBilling(data);
		}
	}
}
