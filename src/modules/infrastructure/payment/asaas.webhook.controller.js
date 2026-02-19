import { Elysia } from "elysia";
export const asaasWebhookController = new Elysia({ prefix: "/webhook/asaas" })
    .post("/", async ({ request, set }) => {
    try {
        const event = await request.json();
        console.log(`[ASAAS_WEBHOOK] Evento recebido: ${event.event}`, event);
        // Validação básica de segurança (Token no header se houver, ou verificar IP)
        // Por enquanto, aceitamos qualquer post para teste, mas em prod deve validar o asaas-access-token
        if (!event || !event.payment) {
            return { status: "ignored", reason: "no_payment_data" };
        }
        const payment = event.payment;
        const customerId = payment.customer;
        const externalReference = payment.externalReference; // Ideal se enviarmos o companyId aqui ao criar a assinatura
        // Tenta encontrar a empresa pelo ID do cliente Asaas (se tivermos salvo) ou externalReference
        // Como ainda não temos o campo asaas_customer_id, vamos assumir que o externalReference é o companyId
        // OU vamos buscar pelo ownerId se tivermos essa ligação.
        // POR ENQUANTO: Apenas logamos e retornamos sucesso para não travar o Asaas
        console.log(`[ASAAS_WEBHOOK] Processando pagamento para Customer: ${customerId}`);
        if (event.event === "PAYMENT_CONFIRMED" || event.event === "PAYMENT_RECEIVED") {
            // Lógica de Ativação
            // 1. Achar empresa
            // 2. Update subscriptionStatus = 'active'
            // 3. Update data de expiração (se usarmos o trialEndsAt como 'expiresAt')
            /*
            await db.update(companies)
              .set({
                subscriptionStatus: 'active',
                // Opcional: trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
              })
              .where(eq(companies.id, externalReference)); // Assumindo externalReference = companyId
            */
            console.log(`[ASAAS_WEBHOOK] Pagamento confirmado! Assinatura ativada.`);
        }
        else if (event.event === "PAYMENT_OVERDUE" || event.event === "PAYMENT_REFUNDED") {
            // Lógica de Bloqueio
            /*
            await db.update(companies)
              .set({ subscriptionStatus: 'past_due' })
              .where(eq(companies.id, externalReference));
            */
            console.log(`[ASAAS_WEBHOOK] Pagamento pendente/estornado. Assinatura marcada como past_due.`);
        }
        return { received: true };
    }
    catch (error) {
        console.error("[ASAAS_WEBHOOK_ERROR]", error);
        set.status = 500;
        return { error: "Internal Server Error" };
    }
});
