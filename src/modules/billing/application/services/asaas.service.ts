import {
	IBillingPort,
	ICardResponse,
	IPixResponse,
	ISlipResponse,
} from "../../domain/ports/billing.port";
import { AsaasIntegration } from "../../adapters/out/asaas/asaas.integration";
import {
	CreateBillingDTO,
	CreateCardBillingDTO,
} from "../../domain/DTO/create-billing.dto";

export class AsaasService implements IBillingPort {
	constructor(private readonly asaasIntegration: AsaasIntegration) {}

	async generatePixBilling(data: CreateBillingDTO): Promise<IPixResponse> {
		const customerExists = await this.asaasIntegration.getCustomer({
			email: data.user.email,
		});

		const customer = customerExists.totalCount
			? customerExists.data?.[0]
			: await this.asaasIntegration.createCustomer({
					name: data.user.name,
					cpfCnpj: data.user.document,
				});

		const billing = await this.asaasIntegration.generatePixBilling({
			billingType: "PIX",
			customer: customer.id,
			value: data.value,
			dueDate: data.dueDate,
		});

		return {
			code: billing.pixQrCodeId,
			externalId: billing.id,
			invoice: billing.invoiceUrl,
		};
	}

	async generateBankSlipBilling(
		data: CreateBillingDTO,
	): Promise<ISlipResponse> {
		const customerExists = await this.asaasIntegration.getCustomer({
			email: data.user.email,
		});

		const customer = customerExists.totalCount
			? customerExists.data?.[0]
			: await this.asaasIntegration.createCustomer({
					name: data.user.name,
					cpfCnpj: data.user.document,
				});

		const billing = await this.asaasIntegration.generateSlipBilling({
			billingType: "BOLETO",
			customer: customer.id,
			value: data.value,
			dueDate: data.dueDate,
		});

		return {
			externalId: billing.id,
			url: billing.bankSlipUrl,
			invoice: billing.invoiceUrl,
		};
	}

	async generateCreditCardBilling(
		data: CreateCardBillingDTO,
	): Promise<ICardResponse> {
		const customerExists = await this.asaasIntegration.getCustomer({
			email: data.user.email,
		});

		const customer = customerExists.totalCount
			? customerExists.data?.[0]
			: await this.asaasIntegration.createCustomer({
					name: data.user.name,
					cpfCnpj: data.user.document,
				});

		const billing = await this.asaasIntegration.generateCardBilling({
			billingType: "CREDIT_CARD",
			customer: customer.id,
			value: data.value,
			dueDate: data.dueDate,
			creditCard: {
				holderName: data.creditCard.holderName,
				number: data.creditCard.number,
				expiryMonth: Number(data.creditCard.expiryMonth),
				expiryYear: Number(data.creditCard.expiryYear),
				ccv: data.creditCard.cvv,
			},
			creditCardHolderInfo: {
				name: data.user.name,
				email: data.user.email,
				cpfCnpj: data.user.document,
				postalCode: data.address.postalCode,
				addressNumber: data.address.addressNumber,
				addressComplement: data.address.addressComplement,
				phone: data.address.phone,
				mobilePhone: data.user.mobilePhone,
			},
			remoteIp: "[IP_ADDRESS]",
		});

		return {
			externalId: billing.id,
			receipt: billing.transactionReceiptUrl,
			invoice: billing.invoiceUrl,
		};
	}
}
