export class AsaasClient {
  private apiKey: string;
  private apiUrl: string;

  constructor() {
    this.apiKey = process.env.ASAAS_API_KEY || "";
    this.apiUrl = process.env.ASAAS_API_URL || "https://sandbox.asaas.com/api/v3";
  }

  // Método placeholder para criar cliente
  async createCustomer(data: { name: string; cpfCnpj: string; email: string }) {
    if (!this.apiKey) {
      console.warn("[ASAAS_CLIENT] Sem API Key. Retornando mock.");
      return { id: "cus_mock_123" };
    }
    // Implementação real viria aqui (fetch/axios)
    return { id: "cus_mock_real_impl_pending" };
  }

  // Método placeholder para criar assinatura
  async createSubscription(data: { customerId: string; value: number; nextDueDate: string }) {
     if (!this.apiKey) {
      console.warn("[ASAAS_CLIENT] Sem API Key. Retornando mock.");
      return { id: "sub_mock_123", status: "PENDING" };
    }
    // Implementação real viria aqui
    return { id: "sub_mock_real_impl_pending", status: "PENDING" };
  }
}

export const asaas = new AsaasClient();
