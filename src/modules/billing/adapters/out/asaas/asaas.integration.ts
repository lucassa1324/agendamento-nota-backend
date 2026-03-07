import axios, { AxiosError, AxiosInstance } from "axios";
import {
	IAsaasCreateBankSlipRequest,
	IAsaasCreateCreditCardRequest,
	IAsaasCreateCustomerRequest,
	IAsaasCreatePixRequest,
	IAsaasCustomer,
	IAsaasListCustomerQuery,
	IAssasCreateBillingResponse,
	IAssasListCustomerResponse,
} from "./asaas.types";
import { environment } from "../../../../infrastructure/environment/environment";

export class AsaasIntegration {
	private readonly baseUrl = environment.asaas.baseUrl;
	private readonly headers = {
		"Content-Type": "application/json",
		"User-Agent": "nome_da_sua_aplicação",
		access_token: environment.asaas.accessToken,
	};
	private readonly client: AxiosInstance;

	constructor() {
		this.client = axios.create({
			baseURL: this.baseUrl,
			headers: this.headers,
		});

		this.setupInterceptors();
	}

	private setupInterceptors() {
		this.client.interceptors.response.use(
			(response) => response,
			(error: AxiosError) => {
				console.error("Erro na API Asaas: ", error.response?.data);
				return Promise.reject(error);
			},
		);
	}

	async createCustomer(
		customer: IAsaasCreateCustomerRequest,
	): Promise<IAsaasCustomer> {
		const req = await this.client.post(`/v3/customers`, customer);

		return req.data;
	}

	async getCustomer(
		params: IAsaasListCustomerQuery,
	): Promise<IAssasListCustomerResponse> {
		return this.client.get(`/v3/customers`, { params }).then((res) => res.data);
	}

	async generatePixBilling(
		body: IAsaasCreatePixRequest,
	): Promise<IAssasCreateBillingResponse> {
		const req = await this.client.post(`/v3/payments`, body);

		return req.data;
	}

	async generateSlipBilling(
		body: IAsaasCreateBankSlipRequest,
	): Promise<IAssasCreateBillingResponse> {
		const req = await this.client.post(`/v3/payments`, body);

		return req.data;
	}

	async generateCardBilling(
		body: IAsaasCreateCreditCardRequest,
	): Promise<IAssasCreateBillingResponse> {
		const req = await this.client.post(`/v3/payments`, body);

		return req.data;
	}
}
