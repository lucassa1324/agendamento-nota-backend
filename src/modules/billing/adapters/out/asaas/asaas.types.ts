export interface IAsaasCreateCustomerRequest {
	name: string;
	cpfCnpj: string;
}

export interface IAsaasListCustomerQuery {
	offset?: number;
	limit?: number;
	name?: string;
	email?: string;
	cpfCnpj?: string;
	groupName?: string;
	externalReference?: string;
}

export interface IAssasListCustomerResponse {
	object: string;
	hasMore: boolean;
	totalCount: number;
	limit: number;
	offset: number;
	data: Array<IAsaasCustomer>;
}

export interface IAsaasCustomer {
	object: string;
	id: string;
	dateCreated: string;
	name: string;
	email: any;
	company: any;
	phone: any;
	mobilePhone: any;
	address: any;
	addressNumber: any;
	complement: any;
	province: any;
	postalCode: any;
	cpfCnpj: string;
	personType: string;
	deleted: boolean;
	additionalEmails: any;
	externalReference: any;
	notificationDisabled: boolean;
	observations: any;
	municipalInscription: any;
	stateInscription: any;
	canDelete: boolean;
	cannotBeDeletedReason: any;
	canEdit: boolean;
	cannotEditReason: any;
	city: any;
	cityName: any;
	state: any;
	country: string;
}

export interface IAsaasCreatePixRequest {
	billingType: "PIX";
	customer: string;
	value: number;
	dueDate: string;
}

export interface IAsaasCreateBankSlipRequest {
	billingType: "BOLETO";
	customer: string;
	value: number;
	dueDate: string;
}

export interface IAsaasCreateCreditCardRequest {
	billingType: "CREDIT_CARD";
	customer: string;
	value: number;
	dueDate: string;
	creditCard: {
		holderName: string;
		number: string;
		expiryMonth: number;
		expiryYear: number;
		ccv: string;
	};
	creditCardHolderInfo: {
		name: string;
		email: string;
		cpfCnpj: string;
		postalCode: string;
		addressNumber: string;
		addressComplement: string;
		phone: string;
		mobilePhone: string;
	};
	remoteIp: string;
}

export interface IAssasCreateBillingResponse {
	object: string;
	id: string;
	dateCreated: string;
	customer: string;
	subscription: any;
	installment: any;
	checkoutSession: string;
	paymentLink: any;
	value: number;
	netValue: number;
	originalValue: any;
	interestValue: any;
	description: string;
	billingType: string;
	creditCard: {
		creditCardNumber: string;
		creditCardBrand: string;
		creditCardToken: any;
	};
	canBePaidAfterDueDate: boolean;
	pixTransaction: any;
	pixQrCodeId: any;
	status: string;
	dueDate: string;
	originalDueDate: string;
	paymentDate: any;
	clientPaymentDate: any;
	installmentNumber: any;
	invoiceUrl: string;
	invoiceNumber: string;
	externalReference: string;
	deleted: boolean;
	anticipated: boolean;
	anticipable: boolean;
	creditDate: string;
	estimatedCreditDate: string;
	transactionReceiptUrl: any;
	nossoNumero: string;
	bankSlipUrl: string;
	discount: {
		value: number;
		dueDateLimitDays: number;
		type: string;
	};
	fine: {
		value: number;
	};
	interest: {
		value: number;
	};
	split: Array<{
		id: string;
		walletId: string;
		fixedValue: number;
		percentualValue: any;
		totalValue: number;
		cancellationReason: string;
		status: string;
		externalReference: any;
		description: any;
	}>;
	postalService: boolean;
	daysAfterDueDateToRegistrationCancellation: any;
	chargeback: {
		id: string;
		payment: string;
		installment: string;
		customerAccount: string;
		status: string;
		reason: string;
		disputeStartDate: string;
		value: number;
		paymentDate: string;
		creditCard: {
			number: string;
			brand: string;
		};
		disputeStatus: string;
		deadlineToSendDisputeDocuments: string;
	};
	escrow: {
		id: string;
		status: string;
		expirationDate: string;
		finishDate: string;
		finishReason: string;
	};
	refunds: Array<{
		dateCreated: string;
		status: string;
		value: number;
		endToEndIdentifier: any;
		description: any;
		effectiveDate: string;
		transactionReceiptUrl: any;
		refundedSplits: Array<{
			id: string;
			value: number;
			done: boolean;
		}>;
	}>;
}
