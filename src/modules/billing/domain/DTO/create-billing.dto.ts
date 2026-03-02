import { t } from "elysia";

export const paymentMethods = {
	PIX: "PIX",
	SLIP: "SLIP",
	CARD: "CARD",
} as const;

export const createPixBillingDTO = t.Object({
	billingType: t.Literal(paymentMethods.PIX),
	value: t.Number(),
	dueDate: t.String(),
	user: t.Object({
		name: t.String(),
		email: t.String(),
		document: t.String(),
	}),
});

export const createSlipBillingDTO = t.Object({
	billingType: t.Literal(paymentMethods.SLIP),
	value: t.Number(),
	dueDate: t.String(),
	user: t.Object({
		name: t.String(),
		email: t.String(),
		document: t.String(),
	}),
});

export const createCardBillingDTO = t.Object({
	billingType: t.Literal(paymentMethods.CARD),
	value: t.Number(),
	dueDate: t.String(),
	user: t.Object({
		name: t.String(),
		email: t.String(),
		document: t.String(),
		mobilePhone: t.String(),
	}),
	creditCard: t.Object({
		holderName: t.String(),
		number: t.String(),
		expiryMonth: t.String(),
		expiryYear: t.String(),
		cvv: t.String(),
	}),
	address: t.Object({
		postalCode: t.String(),
		addressNumber: t.String(),
		addressComplement: t.String(),
		phone: t.String(),
	}),
});

export const createBillingDTO = t.Union([
	createPixBillingDTO,
	createSlipBillingDTO,
	createCardBillingDTO,
]);

export type CreatePixBillingDTO = typeof createPixBillingDTO.static;
export type CreateSlipBillingDTO = typeof createSlipBillingDTO.static;
export type CreateCardBillingDTO = typeof createCardBillingDTO.static;
export type CreateBillingDTO = typeof createBillingDTO.static;
export type PaymentMethods =
	(typeof paymentMethods)[keyof typeof paymentMethods];
