import { Elysia, t } from "elysia";
import { stripe } from "./stripe.client";
import { authPlugin } from "../auth/auth-plugin";
export const stripeCheckoutController = new Elysia({ prefix: "/stripe" })
    .use(authPlugin)
    .post("/create-checkout-session", async ({ user, body, set }) => {
    if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
    }
    if (!user.businessId) {
        set.status = 400;
        return { error: "User has no business associated" };
    }
    const { priceId } = body;
    try {
        const session = await stripe.checkout.sessions.create({
            mode: "subscription",
            payment_method_types: ["card"],
            line_items: [
                {
                    price: priceId || process.env.STRIPE_PRICE_ID,
                    quantity: 1,
                },
            ],
            // Ajuste as URLs conforme necessário
            success_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/settings/subscription?checkout_success=true`,
            cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/settings/subscription?checkout_canceled=true`,
            customer_email: user.email,
            client_reference_id: user.businessId,
            metadata: {
                userId: user.id,
                businessId: user.businessId
            }
        });
        return { url: session.url };
    }
    catch (error) {
        console.error("Stripe Checkout Error:", error);
        set.status = 500;
        return { error: error.message };
    }
}, {
    body: t.Object({
        priceId: t.Optional(t.String())
    })
});
