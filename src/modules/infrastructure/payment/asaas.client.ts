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

  async cancelSubscription(subscriptionId: string) {
    if (!subscriptionId) {
      console.warn("[ASAAS_CLIENT] SubscriptionId vazio. Ignorando cancelamento.");
      return { status: "SKIPPED" };
    }

    if (!this.apiKey) {
      console.warn("[ASAAS_CLIENT] Sem API Key. Retornando mock.");
      return { id: subscriptionId, status: "MOCK_CANCELLED" };
    }

    return { id: subscriptionId, status: "CANCEL_PENDING_IMPL" };
  }

  // Método placeholder para aplicar desconto
  async applyDiscount(subscriptionId: string, discount: { percentage: number; cycles: number }) {
    if (!subscriptionId) {
      console.warn("[ASAAS_CLIENT] SubscriptionId vazio. Ignorando desconto.");
      return { status: "SKIPPED" };
    }

    if (!this.apiKey) {
      console.warn(`[ASAAS_CLIENT] Sem API Key. Aplicando desconto mock de ${discount.percentage}% por ${discount.cycles} ciclos.`);
      return { id: subscriptionId, status: "MOCK_DISCOUNT_APPLIED" };
    }

    // Implementação real viria aqui (update subscription)
    return { id: subscriptionId, status: "DISCOUNT_PENDING_IMPL" };
  }
}

export const asaas = new AsaasClient();
