import { Elysia } from "elysia";
import { stripe } from "./stripe.client";
import { db } from "../drizzle/database";
import { companies } from "../../../db/schema";
import { eq } from "drizzle-orm";

export const stripeWebhookController = new Elysia({ prefix: "/stripe" })
  .post("/webhook", async ({ request, set }) => {
    const signature = request.headers.get("stripe-signature");
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error("STRIPE_WEBHOOK_SECRET is missing");
      set.status = 500;
      return "Webhook Secret Missing";
    }

    if (!signature) {
      set.status = 400;
      return "Signature missing";
    }

    const body = await request.text();
    let event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: any) {
      console.error(`Webhook signature verification failed: ${err.message}`);
      set.status = 400;
      return `Webhook Error: ${err.message}`;
    }

    console.log(`[STRIPE_WEBHOOK] Event received: ${event.type}`);

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as any;

          // Metadata deve conter o ID da empresa ou do usuário
          // session.client_reference_id geralmente é usado para isso
          const companyId = session.client_reference_id;
          const subscriptionId = session.subscription;
          const customerId = session.customer;

          if (companyId) {
            await db.update(companies)
              .set({
                subscriptionStatus: 'active',
                stripeCustomerId: customerId as string,
                stripeSubscriptionId: subscriptionId as string,
                updatedAt: new Date()
              })
              .where(eq(companies.id, companyId));

            console.log(`[STRIPE_WEBHOOK] Company ${companyId} activated.`);
          }
          break;
        }

        case "customer.subscription.updated": {
          const subscription = event.data.object as any;
          const status = subscription.status; // active, past_due, canceled, incomplete
          const customerId = subscription.customer;

          // Mapeia status do Stripe para nosso enum
          // Stripe: trialing, active, incomplete, incomplete_expired, past_due, canceled, unpaid
          // Nosso: trial, active, past_due, canceled, manual_active

          let newStatus = 'active';
          if (status === 'past_due' || status === 'unpaid') newStatus = 'past_due';
          if (status === 'canceled' || status === 'incomplete_expired') newStatus = 'canceled';
          if (status === 'trialing') newStatus = 'trial';

          // Busca empresa pelo stripe_customer_id
          const company = await db.select().from(companies).where(eq(companies.stripeCustomerId, customerId as string)).limit(1);

          if (company.length > 0) {
            const currentCompany = company[0];

            // Se access_type for manual, ignoramos atualizações automáticas de status (exceto se for para ativar?)
            // O user pediu para travar em 'manual' para evitar desativação.
            if (currentCompany.accessType === 'manual') {
              console.log(`[STRIPE_WEBHOOK] Skipping update for manual company ${currentCompany.id}`);
            } else {
              await db.update(companies)
                .set({
                  subscriptionStatus: newStatus,
                  updatedAt: new Date()
                })
                .where(eq(companies.id, currentCompany.id));

              console.log(`[STRIPE_WEBHOOK] Company ${currentCompany.id} updated to ${newStatus}`);
            }
          }
          break;
        }

        case "customer.subscription.deleted": {
          const subscription = event.data.object as any;
          const customerId = subscription.customer;

          const company = await db.select().from(companies).where(eq(companies.stripeCustomerId, customerId as string)).limit(1);

          if (company.length > 0) {
            const currentCompany = company[0];
            if (currentCompany.accessType !== 'manual') {
              await db.update(companies)
                .set({
                  subscriptionStatus: 'canceled',
                  updatedAt: new Date()
                })
                .where(eq(companies.id, currentCompany.id));
              console.log(`[STRIPE_WEBHOOK] Company ${currentCompany.id} canceled.`);
            }
          }
          break;
        }
      }
    } catch (err: any) {
      console.error(`[STRIPE_WEBHOOK_ERROR] ${err.message}`);
      set.status = 500;
      return `Server Error: ${err.message}`;
    }

    return { received: true };
  });
