import { CreateBillingDTO } from "../DTO/create-billing.dto";

interface IBillingResponse {
	externalId: string;
	invoice: string;
}

export interface IPixResponse extends IBillingResponse {
	code: string;
}

export interface ISlipResponse extends IBillingResponse {
	url: string;
}

export interface ICardResponse extends IBillingResponse {
	receipt: string;
}

export interface IBillingPort {
	generatePixBilling(data: CreateBillingDTO): Promise<IPixResponse>;
	generateBankSlipBilling(data: CreateBillingDTO): Promise<ISlipResponse>;
	generateCreditCardBilling(data: CreateBillingDTO): Promise<ICardResponse>;
}
