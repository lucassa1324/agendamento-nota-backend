import Stripe from 'stripe';
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
    // Em produção, isso deve falhar. Em desenvolvimento, pode ser opcional se não usar Stripe.
    if (process.env.NODE_ENV === 'production') {
        throw new Error('STRIPE_SECRET_KEY is missing');
    }
}
export const stripe = new Stripe(stripeSecretKey || 'sk_test_placeholder', {
    apiVersion: '2026-01-28.clover', // Use latest API version available or check Stripe dashboard
    typescript: true,
});
