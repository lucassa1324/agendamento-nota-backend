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
  async createSubscription(data: { customerId: string; value: number; nextDueDate: string; remoteIp?: string; creditCard?: any; creditCardHolderInfo?: any }) {
    if (!this.apiKey) {
      console.warn("[ASAAS_CLIENT] Sem API Key. Retornando mock.");
      return { id: "sub_mock_123", status: "PENDING" };
    }

    const payload: any = {
      customer: data.customerId,
      billingType: "CREDIT_CARD",
      value: data.value,
      nextDueDate: data.nextDueDate,
      remoteIp: data.remoteIp,
      cycle: "MONTHLY", // Assumindo mensal por padrão, pode ser parametrizado
      description: "Assinatura Agendamento Nota"
    };

    if (data.creditCard) {
      payload.creditCard = data.creditCard;
    }
    if (data.creditCardHolderInfo) {
      payload.creditCardHolderInfo = data.creditCardHolderInfo;
    }

    try {
      console.log("[ASAAS_CLIENT] Criando assinatura...", { ...payload, creditCard: "***" });

      const response = await fetch(`${this.apiUrl}/subscriptions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "access_token": this.apiKey
        },
        body: JSON.stringify(payload)
      });

      const responseData = await response.json();

      if (!response.ok) {
        console.error("[ASAAS_CLIENT] Erro ao criar assinatura:", JSON.stringify(responseData));
        throw new Error((responseData as any).errors?.[0]?.description || "Erro ao criar assinatura no Asaas");
      }

      return responseData;
    } catch (error) {
      console.error("[ASAAS_CLIENT] Exception:", error);
      throw error;
    }
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
